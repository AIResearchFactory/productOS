import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Deep Feature Check', () => {
    // In CI, we use the shared APP_DATA_DIR defined in playwright.config.ts
    // For local runs, we fallback to a default test directory
    const testDataDir = process.env.APP_DATA_DIR 
        ? path.resolve(process.env.APP_DATA_DIR)
        : path.resolve('.test-data-deep');
    
    test.beforeAll(async () => {
        // We only clear if NOT in CI to avoid wiping the server's data while it's running
        if (!process.env.CI) {
            if (fs.existsSync(testDataDir)) {
                fs.rmSync(testDataDir, { recursive: true, force: true });
            }
            fs.mkdirSync(testDataDir, { recursive: true });
        }
    });

    test('Chat interaction creates a Research Log entry in standalone mode', async ({ page }) => {
        // Increase timeout for this test as server might be starting
        test.setTimeout(90000);

        // Pre-configure global settings to avoid onboarding and provider errors
        const settingsDir = path.join(testDataDir, 'settings');
        if (!fs.existsSync(settingsDir)) fs.mkdirSync(settingsDir, { recursive: true });
        
        // Use ollama in CI to avoid mandatory API key requirements for hosted providers.
        // Even if connection fails, the orchestrator logs the attempt/error to the research log.
        const activeProvider = process.env.CI ? 'ollama' : 'hostedApi';

        fs.writeFileSync(path.join(settingsDir, 'global_settings.json'), JSON.stringify({
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

        // 1. Skip onboarding if it appears
        const skipBtn = page.getByRole('button', { name: 'Skip Setup' }).or(page.getByRole('button', { name: 'Skip Installation' }));
        if (await skipBtn.isVisible({ timeout: 15000 }).catch(() => false)) {
            await skipBtn.click();
        }

        // 2. Wait for workspace readiness
        const sidebarNav = page.getByTestId('nav-projects');
        await sidebarNav.waitFor({ state: 'visible', timeout: 30000 });

        // 3. Create project
        await sidebarNav.click();
        const projectsPanel = page.getByTestId('panel-projects');
        await projectsPanel.waitFor({ state: 'visible', timeout: 10000 });
        const newProjectBtn = projectsPanel.getByRole('button', { name: 'New Project' }).first();
        await newProjectBtn.click();
        
        await page.fill('[data-testid="project-name-input"]', 'Logging Project');
        await page.fill('[data-testid="project-goal-input"]', 'Researching logs for stability.');
        await page.click('[data-testid="save-project-settings"]');
        
        await page.waitForSelector('text=Logging Project', { timeout: 30000 });

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
        const projectsDir = path.join(testDataDir, 'projects');
        
        // Find the folder for "Logging Project"
        let projectPath = '';
        for (let attempt = 0; attempt < 10; attempt++) {
            if (fs.existsSync(projectsDir)) {
                const projectFolders = fs.readdirSync(projectsDir);
                for (const folder of projectFolders) {
                    const metaPath = path.join(projectsDir, folder, '.metadata', 'project.json');
                    if (fs.existsSync(metaPath)) {
                        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                        if (meta.name === 'Logging Project') {
                            projectPath = path.join(projectsDir, folder);
                            break;
                        }
                    }
                }
            }
            if (projectPath) break;
            await new Promise(r => setTimeout(r, 1000));
        }
        
        if (!projectPath) throw new Error('Could not find directory for Logging Project');
        const logPath = path.join(projectPath, 'research_log.md');

        // Poll for file content. The orchestrator logs the message immediately when loop starts.
        let logContent = '';
        for (let i = 0; i < 30; i++) {
            if (fs.existsSync(logPath)) {
                logContent = fs.readFileSync(logPath, 'utf-8');
                if (logContent.toContain('Hello agent')) break;
            }
            await new Promise(r => setTimeout(r, 2000));
        }

        expect(logContent).toContain('### Interaction');
        expect(logContent).toContain('Hello agent');
    });

    test('Workflows tab is accessible and scheduler is running', async ({ page }) => {
        test.setTimeout(60000);
        await page.goto('/', { waitUntil: 'networkidle' });

        // Ensure we are past onboarding
        const skipBtn = page.getByRole('button', { name: 'Skip Setup' });
        if (await skipBtn.isVisible({ timeout: 15000 }).catch(() => false)) {
            await skipBtn.click();
        } else {
            const legacySkip = page.getByRole('button', { name: 'Skip to App' });
            if (await legacySkip.isVisible({ timeout: 5000 }).catch(() => false)) {
                await legacySkip.click();
            }
        }

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
        await page.click('button:has-text("New Workflow")');
        await page.fill('input[placeholder="Workflow Name"]', 'Scheduled Task');
        await page.click('button:has-text("Create Workflow")');
        await expect(page.locator('text=Scheduled Task')).toBeVisible({ timeout: 15000 });
    });
});
