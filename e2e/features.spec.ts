import { test, expect } from '@playwright/test';
import { skipSetupAndReach, createProjectViaUI, deleteProjectViaUI, ensureChatVisible } from './helpers';

test.describe('Skills Management', () => {
  let projectName: string;

  test.beforeEach(async ({ page }) => {
    await skipSetupAndReach(page);
    projectName = `Skills Test Project ${Date.now()}`;
  });

  test.afterEach(async ({ page }) => {
    if (projectName) {
      await deleteProjectViaUI(page, projectName).catch(() => {});
    }
  });

  test('skills are available in the workspace', async ({ page }) => {
    await createProjectViaUI(page, projectName, 'Testing skills availability');
    
    // Navigate to skills tab
    const navSkills = page.getByTestId('nav-skills');
    await navSkills.click();
    
    // Verify skills panel is visible
    const skillsPanel = page.getByTestId('panel-skills');
    await expect(skillsPanel).toBeVisible({ timeout: 20000 });

    // Verify header
    const header = page.getByTestId('sidebar-flyout-header');
    await expect(header).toContainText(/Skills/i, { timeout: 15000 });
  });
});

test.describe('Research Log', () => {
  let projectName: string;

  test.beforeEach(async ({ page }) => {
    await skipSetupAndReach(page);
    projectName = `Research Log Project ${Date.now()}`;
    await createProjectViaUI(page, projectName, 'Testing research log features');
  });

  test.afterEach(async ({ page }) => {
    if (projectName) {
      await deleteProjectViaUI(page, projectName).catch(() => {});
    }
  });

  test('research panel is accessible', async ({ page }) => {
    const researchNav = page.getByTestId('nav-research-log');
    await expect(researchNav).toBeVisible({ timeout: 20000 });
    await researchNav.click();
    
    // Check that research log dialog is visible
    await expect(page.getByText(/Research History/i).first()).toBeVisible({ timeout: 20000 });
  });
});

test.describe('Models & Settings', () => {
  let projectName: string;

  test.beforeEach(async ({ page }) => {
    await skipSetupAndReach(page);
    projectName = `Models Test Project ${Date.now()}`;
    await createProjectViaUI(page, projectName, 'Testing models panel');
  });

  test.afterEach(async ({ page }) => {
    if (projectName) {
      await deleteProjectViaUI(page, projectName).catch(() => {});
    }
  });

  test('models panel loads without error', async ({ page }) => {
    await ensureChatVisible(page);

    const navModels = page.getByTestId('nav-models');
    await navModels.click();
    
    // Verify models header in sidebar
    await expect(page.getByRole('heading', { name: 'Models' }).or(page.getByText('Active Provider'))).toBeVisible({ timeout: 20000 });
  });
});
