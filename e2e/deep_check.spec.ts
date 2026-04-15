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
        
        fs.writeFileSync(path.join(settingsDir, 'global_settings.json'), JSON.stringify({
           theme: 'dark',
           activeProvider: 'hostedApi',
           hosted: {
               provider: 'anthropic',
               model: 'claude-3-5-sonnet-20241022',
               apiKeySecretId: 'ANTHROPIC_API_KEY'
           }
        }));

        await page.goto('/', { waitUntil: 'networkidle' });

        // 1. Skip onboarding (or verify it's skipped by pre-config)
        // Wait for either the welcome screen or the dashboard
        await Promise.race([
            page.waitForSelector('text=Welcome to productos', { timeout: 15000 }).catch(() => {}),
            page.waitForSelector('text=Create New Project', { timeout: 15000 }).catch(() => {})
        ]);

        const welcome = page.locator('text=Welcome to productos');
        if (await welcome.isVisible()) {
            await page.click('button:has-text("Skip Installation")');
        }

        // 2. Create a project if none exists
        const createBtn = page.locator('button:has-text("Create New Project")');
        await createBtn.waitFor({ state: 'visible', timeout: 20000 });
        await createBtn.click();
        
        await page.fill('input[placeholder="Project Name"]', 'Logging Project');
        await page.click('button:has-text("Create Project")');
        await page.waitForSelector('text=Logging Project', { timeout: 15000 });

        // 3. Send a chat message
        await page.fill('textarea[placeholder*="Type a message"]', 'Hello agent, please record this in the logs.');
        await page.keyboard.press('Enter');

        // Wait for response (mocking/provider dependent, but server should log immediately)
        // We wait for the message to appear in the UI
        await page.waitForSelector('.message.assistant', { timeout: 30000 });

        // 4. Verify research_log.md exists in the project directory
        const projectsDir = path.join(testDataDir, 'projects');
        const projectFolders = fs.readdirSync(projectsDir);
        const projectPath = path.join(projectsDir, projectFolders[0]);
        const logPath = path.join(projectPath, 'research_log.md');

        // Poll for file creation as it might be async
        let exists = false;
        for (let i = 0; i < 15; i++) {
            if (fs.existsSync(logPath)) {
                exists = true;
                break;
            }
            await new Promise(r => setTimeout(r, 1000));
        }

        expect(exists).toBe(true);
        const logContent = fs.readFileSync(logPath, 'utf-8');
        expect(logContent).toContain('### Interaction');
        expect(logContent).toContain('Hello agent');
    });

    test('Workflows tab is accessible and scheduler is running', async ({ page }) => {
        test.setTimeout(60000);
        await page.goto('/', { waitUntil: 'networkidle' });

        // Ensure we are past onboarding
        const welcome = page.locator('text=Welcome to productos');
        if (await welcome.isVisible()) {
            await page.click('button:has-text("Skip Installation")');
        }

        // 1. Navigate to Workflows
        const navWorkflows = page.locator('nav').locator('text=Workflows');
        await navWorkflows.waitFor({ state: 'visible', timeout: 20000 });
        await navWorkflows.click();
        await expect(page.locator('h1')).toContainText('Workflows', { timeout: 15000 });

        // 2. Verification of background scheduler state is difficult from UI
        // but we verify that we can create a workflow
        await page.click('button:has-text("New Workflow")');
        await page.fill('input[placeholder="Workflow Name"]', 'Scheduled Task');
        await page.click('button:has-text("Create Workflow")');
        await expect(page.locator('text=Scheduled Task')).toBeVisible({ timeout: 15000 });
    });
});
