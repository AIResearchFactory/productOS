import { test, expect } from '@playwright/test';
import { skipSetupAndReach, createProjectViaUI } from './helpers';

test.describe('Chat & AI Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await skipSetupAndReach(page);
    // Use unique project name to avoid "path already exists" errors in CI
    const uniqueProjectName = `Chat Test Project ${Date.now()}`;
    await createProjectViaUI(page, uniqueProjectName, 'Testing chat');
  });

  test('chat input is visible in workspace', async ({ page }) => {
    const chatInput = page.getByTestId('chat-input');
    await expect(chatInput).toBeVisible({ timeout: 15000 });
  });

  test('token saver toggle switches state', async ({ page }) => {
    const toggle = page.getByTestId('token-saver-toggle');
    await expect(toggle).toBeVisible({ timeout: 15000 });
    
    // 1. Get initial state
    const initialState = await toggle.getAttribute('aria-checked');
    console.log(`[ChatSpec] Initial toggle state: ${initialState}`);

    // 2. Perform click and wait for change
    const expectedState = initialState === 'true' ? 'false' : 'true';
    
    // We try up to 3 times because React state updates mixed with E2E clicks can be racey
    let success = false;
    for (let i = 0; i < 3; i++) {
        await toggle.click({ force: true });
        try {
            await expect(toggle).toHaveAttribute('aria-checked', expectedState, { timeout: 3000 });
            success = true;
            break;
        } catch (e) {
            console.log(`[ChatSpec] Toggle click attempt ${i+1} failed to change state, retrying...`);
        }
    }

    expect(success).toBe(true);
    console.log(`[ChatSpec] Toggle state changed successfully to: ${expectedState}`);
  });

  test('retry button appears for injected error', async ({ page }) => {
    await page.getByTestId('nav-projects').click();

    // Inject a chat error
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('productos:test-inject-chat-error', {
        detail: { content: 'Injected failure from E2E' }
      }));
    });

    // Check for retry button
    const retryBtn = page.locator('[data-testid^="chat-retry-"]').first();
    await expect(retryBtn).toBeVisible({ timeout: 10000 });
  });
});
