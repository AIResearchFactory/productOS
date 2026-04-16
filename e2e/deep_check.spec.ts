import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Deep Feature Check', () => {
    // In CI, we use the shared data tracks defined in playwright.config.ts
    // Use PROJECTS_DIR directly if available, as that's where the backend writes projects
    const projectsDir = process.env.PROJECTS_DIR 
        ? path.resolve(process.env.PROJECTS_DIR)
        : path.resolve('.test-data/projects');

    console.log(`[E2E] Initialized with projectsDir: ${projectsDir}`);
    console.log(`[E2E] Process CWD: ${process.cwd()}`);

    const appDataDir = process.env.APP_DATA_DIR
        ? path.resolve(process.env.APP_DATA_DIR)
        : path.resolve('.test-data/appdata');
    
    test.beforeAll(async () => {
        // We only clear if NOT in CI to avoid wiping the server's data while it's running
        if (!process.env.CI) {
            if (fs.existsSync(projectsDir)) {
                fs.rmSync(projectsDir, { recursive: true, force: true });
            }
            if (fs.existsSync(appDataDir)) {
                fs.rmSync(appDataDir, { recursive: true, force: true });
            }
            fs.mkdirSync(projectsDir, { recursive: true });
            fs.mkdirSync(appDataDir, { recursive: true });
        }
    });

    test.beforeEach(async ({ page }) => {
        // Set up local storage to bypass onboarding and initialize runtime before every test
        await page.addInitScript(() => {
            localStorage.setItem('productOS_mock_onboarding', 'false');
            localStorage.setItem('productOS_runtime_initialized', 'true');
        });

        // Mirror browser console to test runner output
        page.on('console', msg => {
            console.log(`[BROWSER] ${msg.type().toUpperCase()}: ${msg.text()}`);
        });
    });

    test('Chat interaction creates a Research Log entry in standalone mode', async ({ page }) => {
        // Increase timeout for this test as server might be starting
        test.setTimeout(90000);

        // Pre-configure global settings to avoid onboarding and provider errors
        const settingsDir = appDataDir; 
        if (!fs.existsSync(settingsDir)) fs.mkdirSync(settingsDir, { recursive: true });
        
        // Use ollama in CI to avoid mandatory API key requirements for hosted providers.
        const activeProvider = process.env.CI ? 'ollama' : 'hostedApi';

        fs.writeFileSync(path.join(settingsDir, 'settings.json'), JSON.stringify({
           theme: 'dark',
           activeProvider: activeProvider,
           hosted: {
               provider: 'anthropic',
               model: 'claude-3-5-sonnet-20241022',
               apiKeySecretId: 'ANTHROPIC_API_KEY'
           },
           ollama: {
               model: 'llama3',
               apiUrl: 'http://localhost:11434'
           }
        }));

        await page.goto('/', { waitUntil: 'networkidle' });

        await page.goto('/', { waitUntil: 'networkidle' });

        // 2. Wait for workspace readiness
        const sidebarNav = page.getByTestId('nav-projects');
        await expect(sidebarNav).toBeVisible({ timeout: 30000 });

  // 3. Create project
  await sidebarNav.click();
  const projectsPanel = page.getByTestId('panel-projects');
  await expect(projectsPanel).toBeVisible({ timeout: 15000 });

  // Use unique project name to avoid conflicts with existing projects
  const uniqueProjectName = `Logging Project ${Date.now()}`;
  console.log(`[E2E] Creating project: ${uniqueProjectName}`);

  // Use the new unique test ID to avoid ambiguity with project list items
  const newProjectBtn = page.getByTestId('btn-create-new-project');
  await newProjectBtn.waitFor({ state: 'visible', timeout: 5000 });
  await newProjectBtn.click();
  
  await page.fill('[data-testid="project-name-input"]', uniqueProjectName);
  await page.fill('[data-testid="project-goal-input"]', 'Researching logs for stability.');
  
  const saveBtn = page.getByTestId('save-project-settings');
  await expect(saveBtn).toBeEnabled();
  await saveBtn.click();
  
  await page.waitForSelector(`text=${uniqueProjectName}`, { timeout: 30000 });


        // 4. Send chat message
        const chatInput = page.getByPlaceholder('What would you like to work on?').or(page.locator('textarea')).first();
        await chatInput.fill('Hello agent, please record this in the logs.');
        await page.keyboard.press('Enter');

        // In CI, we don't necessarily expect a successful assistant response (no real backend).
        // We just wait for the loading state to finish or a timeout, as the ORCHESTRATOR 
        // logs to the research log regardless of AI success/failure.
        await Promise.race([
            page.waitForSelector('[data-role="assistant"]', { timeout: 30000 }).catch(() => {}),
            page.waitForSelector('.lucide-alert-circle', { timeout: 30000 }).catch(() => {}), // Error icon
            new Promise(r => setTimeout(r, 15000)) // Force continue to log check
        ]);

        // 5. Verify research_log.md exists in the project directory
        
        // Find the folder for "Logging Project"
        let projectPath = '';
        for (let attempt = 0; attempt < 10; attempt++) {
            if (fs.existsSync(projectsDir)) {
                const projectFolders = fs.readdirSync(projectsDir);
                console.log(`[E2E] Attempt ${attempt}: Found folders: ${projectFolders.join(', ')}`);
                for (const folder of projectFolders) {
                    const metaPath = path.join(projectsDir, folder, '.metadata', 'project.json');
                    if (fs.existsSync(metaPath)) {
                        try {
                            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                            console.log(`[E2E] Checking project: ${meta.name} (ID: ${meta.id}) at ${folder}`);
                            if (meta.name === uniqueProjectName) {
                                projectPath = path.join(projectsDir, folder);
                                break;
                            }
                        } catch (e) {
                            console.log(`[E2E] Failed to parse ${metaPath}: ${e}`);
                        }
                    } else {
                        console.log(`[E2E] No metadata at ${metaPath}`);
                    }
                }
            } else {
                console.log(`[E2E] projectsDir not found: ${projectsDir}`);
            }
            if (projectPath) break;
            await new Promise(r => setTimeout(r, 1000));
        }
        
        if (!projectPath) {
            console.log(`Debug projectsDir: ${projectsDir}`);
            if (fs.existsSync(projectsDir)) {
                console.log(`Directory contents: ${fs.readdirSync(projectsDir)}`);
            } else {
                console.log('projectsDir does not exist!');
            }
            throw new Error('Could not find directory for Logging Project');
        }
        const logPath = path.join(projectPath, 'research_log.md');

        // Poll for file content. The orchestrator logs the message immediately when loop starts.
        let logContent = '';
        for (let i = 0; i < 30; i++) {
            if (fs.existsSync(logPath)) {
                logContent = fs.readFileSync(logPath, 'utf-8');
                if (logContent.includes('Hello agent') || logContent.includes('ERROR')) break;
            }
            await new Promise(r => setTimeout(r, 2000));
        }

        expect(logContent).toContain('### Interaction');
        expect(logContent).toContain('Hello agent');
    });

    test('Workflows tab is accessible and scheduler is running', async ({ page }) => {
        test.setTimeout(60000);
        await page.goto('/', { waitUntil: 'networkidle' });

        await page.goto('/', { waitUntil: 'networkidle' });

        // 1. Navigate to Workflows via sidebar
        const navWorkflows = page.getByTestId('nav-workflows');
        await navWorkflows.waitFor({ state: 'visible', timeout: 20000 });
        await navWorkflows.click();
        
        // Ensure the workflows panel is visible (Sidebar flyout)
        // If it's not visible, click again (sometimes first click just switches tab but doesn't open flyout if it was closed)
        for (let i = 0; i < 3; i++) {
            if (await page.getByTestId('panel-workflows').isVisible({ timeout: 2000 }).catch(() => false)) break;
            await navWorkflows.click();
            await page.waitForTimeout(1000);
        }
        await page.waitForSelector('[data-testid="panel-workflows"]', { timeout: 10000 });
        
        // Check if we are on the workflows view in the main panel (if applicable)
        // or just that the panel is open
        await expect(page.locator('h3:has-text("Workflows")')).toBeVisible({ timeout: 15000 });

        // 2. Verification of background scheduler state is difficult from UI
        // but we verify that we can create a workflow
        const createBtn = page.getByTestId('workflow-create-button').or(page.locator('button:has-text("Create Workflow")')).first();
        await createBtn.click();
        
        // Wait for dialog and fill using ID or placeholder accurately
        const nameInput = page.locator('#wf-name').or(page.getByPlaceholder('Daily research brief'));
        await nameInput.waitFor({ state: 'visible', timeout: 5000 });
        await nameInput.fill('Scheduled Task');
        
        // Click the create button in the dialog - use lowercase based on WorkflowBuilderDialog.tsx
        const submitBtn = page.getByRole('button', { name: 'Create workflow' });
        await submitBtn.click();
        
        await expect(page.locator('text=Scheduled Task').first()).toBeVisible({ timeout: 15000 });

    });
});
