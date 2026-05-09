import { test, expect } from '@playwright/test';
import { skipSetupAndReach, createProjectViaUI, deleteProjectViaUI } from './helpers';

test.describe('Product CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await skipSetupAndReach(page);
  });

  test('create a new project with name and goal', async ({ page }) => {
    const uniqueName = `E2E Test Project ${Date.now()}`;
    await createProjectViaUI(page, uniqueName, 'Testing project lifecycle');

    // Verify project appears in sidebar flyout
    const projectItem = page.getByTestId('panel-projects').getByText(uniqueName, { exact: true });
    await expect(projectItem).toBeVisible({ timeout: 10000 });

    // Cleanup
    await deleteProjectViaUI(page, uniqueName);
  });

  test('project list shows entries in sidebar', async ({ page }) => {
    // Click Projects tab to open the flyout
    await page.getByTestId('nav-products').click();

    // The projects panel should be visible
    const projectsPanel = page.getByTestId('panel-projects');
    await expect(projectsPanel).toBeVisible({ timeout: 10000 });
  });

  test('clicking New Product opens product settings form', async ({ page }) => {
    // Click Projects to open flyout
    await page.getByTestId('nav-products').click();

    // The projects panel should be visible
    const projectsPanel = page.getByTestId('panel-projects');
    await expect(projectsPanel).toBeVisible({ timeout: 10000 });

    // Click "New Product" button (using stable data-testid)
    const newProjectBtn = page.getByTestId('btn-create-new-project');
    await newProjectBtn.waitFor({ state: 'visible', timeout: 5000 });
    await newProjectBtn.click();

    // Verify product settings form appears
    const settingsPage = page.getByTestId('project-settings-page');
    await expect(settingsPage).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('project-name-input')).toBeVisible();
    await expect(page.getByTestId('project-goal-input')).toBeVisible();
    await expect(page.getByTestId('save-project-settings')).toBeVisible();
    await expect(page.getByText('Product Name')).toBeVisible();
  });

  test('selecting a product lands on product home', async ({ page }) => {
    const uniqueName = `E2E Product Home ${Date.now()}`;
    await createProjectViaUI(page, uniqueName, 'Testing product home flow');

    await expect(page.getByTestId('product-home')).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('heading', { name: uniqueName })).toBeVisible();
    await expect(page.getByText('Next best action')).toBeVisible();

    await deleteProjectViaUI(page, uniqueName);
  });
});
