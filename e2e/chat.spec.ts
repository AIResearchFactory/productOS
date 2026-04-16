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
    await expect(toggle).toBeVisible({ timeout: 10000 });
    // Check the toggle state using aria-checked
    const isCheckedBefore = await toggle.getAttribute('aria-checked') === 'true';
    console.log(`[ChatSpec] Toggle checked before: ${isCheckedBefore}`);

    // Click the button — use force if needed
    await toggle.click({ force: true });

    // Wait for the state to change
    await expect.poll(async () => {
      const checked = await toggle.getAttribute('aria-checked');
      return checked === (isCheckedBefore ? 'false' : 'true');
    }, {
      message: 'Toggle state did not change',
      timeout: 5000
    }).toBeTruthy();

    console.log(`[ChatSpec] Toggle state changed successfully`);
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
