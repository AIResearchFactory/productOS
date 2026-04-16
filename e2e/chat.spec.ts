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
    const before = await toggle.textContent();
    expect(['Saver ON', 'Saver OFF']).toContain(before?.trim());

    // Use force: true because the sidebar flyout might be overlapping during tests
    await toggle.click({ force: true });

    // Wait for the state to stabilize/update
    await expect(async () => {
        const after = await toggle.textContent();
        expect(after?.trim()).not.toBe(before?.trim());
    }).toPass({ timeout: 5000 });
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
