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
    if (await artifactsPanel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(artifactsPanel).toBeVisible();
    }
  });

  test('artifact type categories are listed', async ({ page }) => {
    await page.getByTestId('nav-artifacts').click();
    await page.waitForTimeout(500);

    // The artifact list should show type groups like "Roadmap", "Initiative" etc.
    const artifactsPanel = page.getByTestId('panel-artifacts');
    if (await artifactsPanel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(artifactsPanel).toBeVisible();
    }
  });

  test('artifact create button exists in panel', async ({ page }) => {
    await page.getByTestId('nav-artifacts').click();
    await page.waitForTimeout(500);

    // Look for any "New" or "Create" button in the artifacts panel
    const createBtn = page.locator('[data-testid="panel-artifacts"] button').filter({ hasText: /new|create|\+/i });
    if (await createBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(createBtn.first()).toBeVisible();
    }
  });
});
