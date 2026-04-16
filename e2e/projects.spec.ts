import { test, expect } from '@playwright/test';
import { skipSetupAndReach, createProjectViaUI } from './helpers';

test.describe('Project CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await skipSetupAndReach(page);
  });

  test('create a new project with name and goal', async ({ page }) => {
    const uniqueName = `E2E Test Project ${Date.now()}`;
    await createProjectViaUI(page, uniqueName, 'Testing project lifecycle');

    // Verify project appears in sidebar flyout
    const projectItem = page.getByTestId('panel-projects').getByText(uniqueName, { exact: true });
    await expect(projectItem).toBeVisible({ timeout: 10000 });
  });

  test('project list shows entries in sidebar', async ({ page }) => {
    // Click Projects tab to open the flyout
    await page.getByTestId('nav-projects').click();

    // The projects panel should be visible
    const projectsPanel = page.getByTestId('panel-projects');
    await expect(projectsPanel).toBeVisible({ timeout: 10000 });
  });

  test('clicking New Project opens settings form', async ({ page }) => {
    // Click Projects to open flyout
    await page.getByTestId('nav-projects').click();

    // The projects panel should be visible
    const projectsPanel = page.getByTestId('panel-projects');
    await expect(projectsPanel).toBeVisible({ timeout: 10000 });

    // Click "New Project" button (using stable data-testid)
    const newProjectBtn = page.getByTestId('btn-create-new-project');
    await newProjectBtn.waitFor({ state: 'visible', timeout: 5000 });
    await newProjectBtn.click();

    // Verify project settings form appears
    const settingsPage = page.getByTestId('project-settings-page');
    await expect(settingsPage).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('project-name-input')).toBeVisible();
    await expect(page.getByTestId('project-goal-input')).toBeVisible();
    await expect(page.getByTestId('save-project-settings')).toBeVisible();
  });
});
