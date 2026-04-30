import { test, expect } from '@playwright/test';
import { skipSetupAndReach, createProjectViaUI, deleteProjectViaUI, ensureChatVisible } from './helpers';

test.describe('Chat & AI Interaction', () => {
  let projectName: string;

  test.beforeEach(async ({ page }) => {
    await skipSetupAndReach(page);
    // Use unique project name to avoid "path already exists" errors in CI
    projectName = `Chat Test Project ${Date.now()}`;
    await createProjectViaUI(page, projectName, 'Testing chat robustness');
    await ensureChatVisible(page);
  });

  test.afterEach(async ({ page }) => {
    if (projectName) {
      await deleteProjectViaUI(page, projectName).catch(() => {});
    }
  });

  test('chat input is visible in workspace', async ({ page }) => {
    const chatInput = page.getByTestId('chat-input');
    await expect(chatInput).toBeVisible({ timeout: 15000 });
  });

  test('token saver toggle switches state', async ({ page }) => {
    const toggle = page.getByTestId('token-saver-toggle');
    await expect(toggle).toBeVisible({ timeout: 15000 });
    
    // Give some time for the UI to be fully interactive
    await page.waitForTimeout(2000);
    
    // 1. Get initial state using text content which is more robust than attributes in CI
    const textContent = await toggle.textContent();
    const initialState = textContent?.includes('ON') ? 'ON' : 'OFF';
    console.log(`[ChatSpec] Initial toggle state: ${initialState}`);

    // 2. Perform click and wait for change
    const expectedText = initialState === 'ON' ? 'OFF' : 'ON';
    
    let success = false;
    for (let i = 0; i < 3; i++) {
        console.log(`[ChatSpec] Toggle click attempt ${i+1}...`);
        
        // Try focusing and pressing space as a more reliable alternative to pointer clicks in some CI envs
        await toggle.focus();
        await page.keyboard.press('Space');
        
        // Also try a forced click if space doesn't work
        await page.waitForTimeout(500);
        await toggle.click({ force: true });
        
        try {
            await expect(toggle).toContainText(expectedText, { timeout: 10000 });
            success = true;
            break;
        } catch (e) {
            console.log(`[ChatSpec] Toggle click attempt ${i+1} failed to change text, retrying...`);
        }
    }

    expect(success).toBe(true);
    console.log(`[ChatSpec] Toggle state changed successfully to: ${expectedText}`);
  });

  test('retry button appears for injected error', async ({ page }) => {
    // Ensure we are in the chat view
    await ensureChatVisible(page);
    await page.waitForTimeout(2000);

    // Inject a chat error
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('productos:test-inject-chat-error', {
        detail: { content: 'Injected failure from E2E' }
      }));
    });

    // Check for retry button
    // The retry button ID is chat-retry-{messageId}
    const retryBtn = page.getByTestId(/chat-retry-/);
    await expect(retryBtn).toBeVisible({ timeout: 20000 });
    
    // Verify it contains "Retry"
    await expect(retryBtn).toContainText(/Retry/i);
  });
});
