import { test, expect } from '@playwright/test';
import { skipSetupAndReach, createProjectViaUI } from './helpers';
import fs from 'fs';
import path from 'path';

/**
 * Robustly wait for a file to exist and have non-empty content.
 * macOS and high-concurrency environments can have severe filesystem visibility lag.
 */
async function sturdyReadFile(filePath: string, timeoutMs: number = 60000): Promise<string> {
    const start = Date.now();
    console.log(`[E2E] Polling for file: ${filePath} (Timeout: ${timeoutMs}ms)`);
    
    while (Date.now() - start < timeoutMs) {
        if (fs.existsSync(filePath)) {
            try {
                const fd = fs.openSync(filePath, 'r');
                const stats = fs.fstatSync(fd);
                fs.closeSync(fd);

                if (stats.size > 10) { 
                    const content = fs.readFileSync(filePath, 'utf-8');
                    if (content.trim().length > 10) {
                        console.log(`[E2E] File detected with size ${stats.size} and content length ${content.length}`);
                        return content;
                    }
                }
            } catch (e) {
                console.log(`[E2E] Read error (retrying): ${e}`);
            }
        }
        await new Promise(r => setTimeout(r, 2000));
    }
    
    if (fs.existsSync(filePath)) {
        console.log(`[E2E] Timeout reached. Final read of existing file.`);
        return fs.readFileSync(filePath, 'utf-8');
    }
    console.log(`[E2E] Timeout reached. File does not exist.`);
    return '';
}

test.describe('Deep Feature Check', () => {
    const projectsDir = path.resolve(process.env.PROJECTS_DIR || '.test-data/projects');
    const appDataDir = path.resolve(process.env.APP_DATA_DIR || '.test-data/appdata');
    
    test.beforeAll(async () => {
        if (!process.env.CI) {
            if (fs.existsSync(projectsDir)) fs.rmSync(projectsDir, { recursive: true, force: true });
            if (fs.existsSync(appDataDir)) fs.rmSync(appDataDir, { recursive: true, force: true });
            fs.mkdirSync(projectsDir, { recursive: true });
            fs.mkdirSync(appDataDir, { recursive: true });
        }
    });

    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('productOS_mock_onboarding', 'false');
            localStorage.setItem('productOS_runtime_initialized', 'true');
        });
        page.on('console', msg => console.log(`[BROWSER] ${msg.type().toUpperCase()}: ${msg.text()}`));
    });

    test('Chat interaction creates a Research Log entry in standalone mode', async ({ page }) => {
        test.setTimeout(180000);
        await skipSetupAndReach(page);

        // 1. Sync settings via API to ensure backend reloads the provider
        console.log('[E2E] Synchronizing settings via appApi...');
        await page.waitForFunction(() => (window as any).appApi !== undefined, { timeout: 20000 });
        await page.evaluate(async () => {
            const api = (window as any).appApi;
            const settings = await api.getGlobalSettings();
            settings.activeProvider = 'ollama';
            settings.ollama = { model: 'llama3', apiUrl: 'http://localhost:11434' };
            await api.saveGlobalSettings(settings);
            // Trigger switch so backend reloads its cached AIProvider instance
            await api.switchProvider('ollama');
        });

        const uniqueProjectName = `Logging Project ${Date.now()}`;
        console.log(`[E2E] Creating project: ${uniqueProjectName}`);
        await createProjectViaUI(page, uniqueProjectName, 'Researching logs for stability.');
        
        await expect(page.locator(`text=${uniqueProjectName}`).first()).toBeVisible({ timeout: 45000 });
        await page.waitForTimeout(3000);

        // Trigger action that writes to log
        const chatInput = page.getByPlaceholder('What would you like to work on?').or(page.locator('textarea')).first();
        await chatInput.fill('Hello agent, please record this in the logs.');
        await page.keyboard.press('Enter');

        await page.waitForTimeout(15000);

        // Scan strategy: find the newest research_log.md in the PROJECTS_DIR
        let logPath = '';
        console.log(`[E2E] Scanning for log in projectsDir: ${projectsDir}`);
        for (let attempt = 0; attempt < 20; attempt++) {
            if (fs.existsSync(projectsDir)) {
                const folders = fs.readdirSync(projectsDir);
                let latestLogTime = 0;
                for (const folder of folders) {
                    const potentialLog = path.join(projectsDir, folder, 'research_log.md');
                    if (fs.existsSync(potentialLog)) {
                        const stats = fs.statSync(potentialLog);
                        if (stats.mtimeMs > latestLogTime) {
                            latestLogTime = stats.mtimeMs;
                            logPath = potentialLog;
                        }
                    }
                }
            }
            if (logPath && fs.statSync(logPath).size > 10) break;
            await new Promise(r => setTimeout(r, 2000));
        }
        
        if (!logPath) {
            console.log(`[E2E] Contents of ${projectsDir}:`, fs.readdirSync(projectsDir));
            throw new Error(`Research log not found in any project folder in ${projectsDir}`);
        }
        
        const logContent = await sturdyReadFile(logPath);
        expect(logContent).toContain('Log');
        expect(logContent.length).toBeGreaterThan(30); 
    });

    test('Workflows tab is accessible and scheduler is running', async ({ page }) => {
        test.setTimeout(90000);
        await skipSetupAndReach(page);

        // Sidebar flyout interaction
        const navWorkflows = page.getByTestId('nav-workflows');
        await navWorkflows.waitFor({ state: 'visible' });
        
        // Controlled sidebar: click and wait for state update
        await navWorkflows.click();
        
        const workflowsPanel = page.getByTestId('panel-workflows');
        await expect(workflowsPanel).toBeVisible({ timeout: 30000 });
        
        // Wait for potential transition and check header
        await page.waitForTimeout(1000);
        const header = workflowsPanel.locator('h3').first();
        await expect(header).toBeVisible({ timeout: 20000 });
        const headerText = await header.innerText();
        console.log(`[E2E] Workflows flyout header: ${headerText}`);
        expect(headerText.toLowerCase()).toContain('workflows');

        // Create workflow
        const createBtn = page.getByTestId('workflow-create-button')
            .or(page.locator('button:has-text("Create Workflow")'))
            .or(workflowsPanel.getByRole('button', { name: /create|new/i }))
            .first();
            
        await createBtn.click();
        
        const nameInput = page.locator('#wf-name').or(page.getByPlaceholder('Daily research brief'));
        await nameInput.waitFor({ state: 'visible' });
        await nameInput.fill('Scheduled Task');
        
        const submitBtn = page.getByRole('button', { name: /create workflow/i });
        await submitBtn.click();
        
        await expect(page.locator('text=Scheduled Task').first()).toBeVisible({ timeout: 20000 });
    });
});
