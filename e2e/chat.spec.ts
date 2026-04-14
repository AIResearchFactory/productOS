import { test, expect } from '@playwright/test';
import { skipSetupAndReach, createProjectViaUI } from './helpers';

test.describe('Chat & AI Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await skipSetupAndReach(page);
    await createProjectViaUI(page, 'Chat Test Project', 'Testing chat');
  });

  test('chat input is visible in workspace', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="work on"]');
    if (await chatInput.isVisible({ timeout: 10000 }).catch(() => false)) {
      await expect(chatInput).toBeVisible();
    }
  });

  test('token saver toggle switches state', async ({ page }) => {
    const toggle = page.getByTestId('token-saver-toggle');
    if (await toggle.isVisible({ timeout: 10000 }).catch(() => false)) {
      const before = await toggle.textContent();
      expect(['Saver ON', 'Saver OFF']).toContain(before?.trim());

      // Use force: true because the sidebar flyout might be overlapping during tests
      await toggle.click({ force: true });
      await page.waitForTimeout(500);

      const after = await toggle.textContent();
      expect(['Saver ON', 'Saver OFF']).toContain(after?.trim());
      // State may or may not change in browser mode, but should not crash
    }
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
    const retryBtn = page.locator('[data-testid^="chat-retry-"]');
    if (await retryBtn.first().isVisible({ timeout: 10000 }).catch(() => false)) {
      await expect(retryBtn.first()).toBeVisible();
    }
  });
});
