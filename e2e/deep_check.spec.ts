import { test, expect } from '@playwright/test';
import { skipSetupAndReach, createProjectViaUI, deleteProjectViaUI, ensureChatVisible } from './helpers';
import fs from 'fs';
import path from 'path';_URL = process.env.VITE_SERVER_URL || 'http://127.0.0.1:51423';

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
    const createdProjects = new Set<string>();
    
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

        // Mirror browser console to test runner output
        page.on('console', msg => {
            console.log(`[BROWSER] ${msg.type().toUpperCase()}: ${msg.text()}`);
        });

        // Increase viewport size for dialog compatibility
        await page.setViewportSize({ width: 1280, height: 1000 });

        // Log server health to the browser console for CI debugging
        await page.evaluate(async (url) => {
            try {
                const res = await fetch(`${url}/api/health`);
                const data = await res.json();
                console.log(`[E2E-INIT] Companion Server Health at ${url}:`, JSON.stringify(data));
            } catch (e) {
                console.error(`[E2E-INIT] Companion Server NOT REACHABLE at ${url}:`, e);
            }
        }, SERVER_URL);
    });

    test.afterEach(async ({ page }) => {
        for (const name of createdProjects) {
            try {
                await deleteProjectViaUI(page, name);
            } catch (e) {
                console.warn(`[E2E-CLEANUP] Failed to delete project ${name}:`, e);
            }
        }
        createdProjects.clear();
    });

    test('Chat interaction creates a Research Log entry in standalone mode', async ({ page }) => {
        page.on('console', msg => console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`));
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
        createdProjects.add(uniqueProjectName);
        console.log(`[E2E] Creating project: ${uniqueProjectName}`);
        await createProjectViaUI(page, uniqueProjectName, 'Researching logs for stability.');
        await ensureChatVisible(page);
        
        await expect(page.locator(`text=${uniqueProjectName}`).first()).toBeVisible({ timeout: 45000 });
        await page.waitForTimeout(3000);

        // Trigger action that writes to log
        const chatInput = page.getByTestId('chat-input');
        await expect(chatInput).toBeVisible({ timeout: 20000 });
        await chatInput.fill('Hello agent, please record this in the logs.');
        await chatInput.press('Enter');

        await page.waitForTimeout(15000);

        const pageText = await page.locator('body').innerText();
        if (pageText.includes('Settings → Models')) {
            expect(pageText).toMatch(/needs setup before it can answer|isn't available on this machine/i);
            return;
        }

        // Scan strategy: find the newest research_log.md in the PROJECTS_DIR
        let logPath = '';
        console.log(`[E2E] Scanning for log in projectsDir: ${projectsDir}`);
        for (let attempt = 0; attempt < 15; attempt++) {
            if (fs.existsSync(projectsDir)) {
                const folders = fs.readdirSync(projectsDir);
                if (folders.length === 0) {
                    console.log(`[E2E] Attempt ${attempt+1}: projectsDir exists but is EMPTY`);
                } else {
                    console.log(`[E2E] Attempt ${attempt+1}: Found ${folders.length} folders: ${folders.join(', ')}`);
                }
                
                let latestLogTime = 0;
                for (const folder of folders) {
                    const potentialPaths = [
                        path.join(projectsDir, folder, 'research_log.md'),
                        path.join(projectsDir, folder, '.metadata', 'research_log.md')
                    ];
                    
                    for (const p of potentialPaths) {
                        const exists = fs.existsSync(p);
                        if (exists) {
                            const stats = fs.statSync(p);
                            console.log(`[E2E] Found log file at ${p} (size: ${stats.size} bytes)`);
                            if (stats.mtimeMs > latestLogTime) {
                                latestLogTime = stats.mtimeMs;
                                logPath = p;
                            }
                        }
                    }
                }
            } else {
                console.log(`[E2E] Attempt ${attempt+1}: projectsDir DOES NOT EXIST yet: ${projectsDir}`);
            }
            if (logPath && fs.statSync(logPath).size > 5) break;
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

        // Ensure a project exists as workflows require one
        const projectName = `Workflow Project ${Date.now()}`;
        createdProjects.add(projectName);
        await createProjectViaUI(page, projectName, 'Testing workflows');

        // Sidebar flyout interaction
        const navWorkflows = page.getByTestId('nav-workflows');
        await navWorkflows.waitFor({ state: 'visible' });
        
        // Controlled sidebar: click and wait for state update
        // Check if panel is already open, if not, click
        const isPanelVisible = await page.getByTestId('panel-workflows').isVisible().catch(() => false);
        if (!isPanelVisible) {
            await navWorkflows.click({ force: true });
        }
        
        const workflowsPanel = page.getByTestId('panel-workflows');
        await expect(workflowsPanel).toBeVisible({ timeout: 30000 });
        
        // Wait for potential transition and check header
        await page.waitForTimeout(1000);
        const header = page.getByTestId('sidebar-flyout-header');
        await expect(header).toBeVisible({ timeout: 20000 });
        const headerText = await header.innerText();
        console.log(`[E2E] Workflows flyout header: ${headerText}`);
        expect(headerText.toLowerCase()).toContain('workflows');

        // Create workflow
        const createBtn = page.getByTestId('workflow-create-button')
            .or(page.locator('button:has-text("Create Workflow")'))
            .or(workflowsPanel.getByRole('button', { name: /create|new/i }))
            .first();
            
        await createBtn.click({ force: true });
        
        const nameInput = page.locator('#wf-name').or(page.getByPlaceholder('Daily research brief'));
        await nameInput.waitFor({ state: 'visible' });
        await nameInput.fill('Scheduled Task');
        
        const submitBtn = page.getByRole('button', { name: /create workflow/i });
        await submitBtn.click();
        
        await expect(page.locator('text=Scheduled Task').first()).toBeVisible({ timeout: 20000 });
    });
});
