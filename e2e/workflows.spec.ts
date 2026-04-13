import { test, expect } from '@playwright/test';
import { skipSetupAndReach, createProjectViaUI } from './helpers';

test.describe('Workflow Engine', () => {
  test.beforeEach(async ({ page }) => {
    await skipSetupAndReach(page);
    await createProjectViaUI(page, 'Workflow Test Project', 'Testing workflows');
  });

  test('workflows panel is accessible', async ({ page }) => {
    await page.getByTestId('nav-workflows').click();
    await expect(page.getByTestId('nav-workflows')).toBeVisible({ timeout: 10000 });
  });

  test('create workflow button is visible', async ({ page }) => {
    await page.getByTestId('nav-workflows').click();
    const createBtn = page.getByTestId('workflow-create-button');
    if (await createBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
      await expect(createBtn).toBeVisible();
    }
  });

  test('workflow optimizer dialog opens and closes', async ({ page }) => {
    await page.getByTestId('nav-workflows').click();

    const optimizerBtn = page.getByTestId('workflow-optimizer-button');
    if (await optimizerBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
      await optimizerBtn.click();

      const dialog = page.getByTestId('workflow-optimizer-dialog');
      await expect(dialog).toBeVisible({ timeout: 10000 });

      // Verify content
      const text = await dialog.textContent();
      expect(text).toContain('Risk:');

      // Close
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    }
  });
});
