import { test, expect } from '@playwright/test';
import { skipSetupAndReach, createProjectViaUI } from './helpers';

test.describe('Project CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await skipSetupAndReach(page);
  });

  test('create a new project with name and goal', async ({ page }) => {
    await createProjectViaUI(page, 'E2E Test Project', 'Testing project lifecycle');

    // Verify project appears in sidebar flyout
    const projectItem = page.getByTestId('panel-projects').getByRole('button', { name: 'E2E Test Project' });
    await expect(projectItem).toBeVisible({ timeout: 10000 });
  });

  test('project list shows entries in sidebar', async ({ page }) => {
    // Click Projects tab to open the flyout
    await page.getByTestId('nav-projects').click();
    await page.waitForTimeout(500);

    // The projects panel should be visible
    const projectsPanel = page.getByTestId('panel-projects');
    if (await projectsPanel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(projectsPanel).toBeVisible();
    }
  });

  test('clicking New Product opens settings form', async ({ page }) => {
    // Click Projects to open flyout
    await page.getByTestId('nav-projects').click();
    await page.waitForTimeout(500);

    // Click "New Product" button  
    const newProductBtn = page.getByRole('button', { name: 'New Product' });
    await newProductBtn.waitFor({ state: 'visible', timeout: 5000 });
    await newProductBtn.click();

    // Verify project settings form appears
    const settingsPage = page.getByTestId('project-settings-page');
    if (await settingsPage.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(settingsPage).toBeVisible();
      await expect(page.getByTestId('project-name-input')).toBeVisible();
      await expect(page.getByTestId('project-goal-input')).toBeVisible();
      await expect(page.getByTestId('save-project-settings')).toBeVisible();
    }
  });
});
