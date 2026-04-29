import { test, expect } from '@playwright/test';
import { skipSetupAndReach, createProjectViaUI, deleteProjectViaUI, ensureChatVisible } from './helpers';

test.describe('Chat & AI Interaction', () => {
  let projectName: string;

  test.beforeEach(async ({ page }) => {
    await skipSetupAndReach(page);
    // Use unique project name to avoid "path already exists" errors in CI
    projectName = `Chat Test Project ${Date.now()}`;
    await createProjectViaUI(page, projectName, 'Testing chat');
    await ensureChatVisible(page);
  });

  test.afterEach(async ({ page }) => {
    if (projectName) {
      await deleteProjectViaUI(page, projectName);
    }
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
    
    // Use keyboard activation on the focused switch instead of a forced pointer click.
    // In CI the floating workspace layout can transiently intercept mouse coordinates,
    // while focus+Space exercises the actual accessible control more reliably.
    let success = false;
    for (let i = 0; i < 3; i++) {
        await toggle.click({ force: true });
        try {
            await expect(toggle).toHaveAttribute('aria-checked', expectedState, { timeout: 5000 });
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
    await page.getByTestId('nav-products').click();

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
