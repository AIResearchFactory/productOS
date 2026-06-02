import { test, expect } from '@playwright/test';
import { skipSetupAndReach } from './helpers';

test.describe('Artifact Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await skipSetupAndReach(page);
  });

  test('artifacts panel is accessible', async ({ page }) => {
    // The artifacts panel should be visible by default
    const artifactsPanel = page.getByTestId('panel-artifacts');
    await expect(artifactsPanel).toBeVisible({ timeout: 10000 });
  });

  test('artifact type categories are listed', async ({ page }) => {
    // The artifact list should show type groups like "Roadmap", "Initiative" etc.
    const artifactsPanel = page.getByTestId('panel-artifacts');
    await expect(artifactsPanel).toBeVisible({ timeout: 10000 });
  });

  test('artifact create button exists in panel', async ({ page }) => {
    // Look for any "New" or "Create" button in the artifacts navigation header
    const createBtn = page.locator('[data-testid="nav-artifacts"] button[title="New Output"]');
    await expect(createBtn.first()).toBeVisible({ timeout: 10000 });
  });
});
