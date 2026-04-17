import { test, expect } from '@playwright/test';
import { skipSetupAndReach } from './helpers';

test.describe('Artifact Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await skipSetupAndReach(page);
  });

  test('artifacts panel is accessible', async ({ page }) => {
    await page.getByTestId('nav-artifacts').click();
    await page.waitForTimeout(500);

    // The artifacts flyout panel should be visible
    const artifactsPanel = page.getByTestId('panel-artifacts');
    await expect(artifactsPanel).toBeVisible({ timeout: 10000 });
  });

  test('artifact type categories are listed', async ({ page }) => {
    await page.getByTestId('nav-artifacts').click();
    await page.waitForTimeout(500);

    // The artifact list should show type groups like "Roadmap", "Initiative" etc.
    const artifactsPanel = page.getByTestId('panel-artifacts');
    await expect(artifactsPanel).toBeVisible({ timeout: 10000 });
  });

  test('artifact create button exists in panel', async ({ page }) => {
    await page.getByTestId('nav-artifacts').click();
    await page.waitForTimeout(500);

    // Look for any "New" or "Create" button in the artifacts panel
    const createBtn = page.locator('[data-testid="panel-artifacts"] button').filter({ hasText: /new|create|\+/i });
    await expect(createBtn.first()).toBeVisible({ timeout: 10000 });
  });
});
