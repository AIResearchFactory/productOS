import { test, expect, type Page } from '@playwright/test';

/**
 * Standard setup for functional E2E tests: bypasses onboarding and waits for 
 * key workspace elements to be visible.
 */
export async function skipSetupAndReach(page: Page) {
  // 1. Initial navigation
  await page.goto('/');

  // 2. Bypass onboarding via localStorage (much faster than clicking wizard)
  await page.evaluate(() => {
    localStorage.setItem('productOS_mock_onboarding', 'false');
    localStorage.setItem('productOS_runtime_initialized', 'true');
  });

  // 3. Reload to ensure app reads the test state
  await page.goto('/');

  // 4. Wait for the main shell to be fully visible and interactive
  const navProjects = page.getByTestId('nav-projects');
  // High timeout because CI environment (especially macOS) can have slow startup
  await expect(navProjects).toBeVisible({ timeout: 30000 });
  await navProjects.waitFor({ state: 'visible' });
}

/** 
 * Create a project through the UI by clicking "New Project" in the sidebar 
 */
export async function createProjectViaUI(page: Page, name: string, description: string) {
  // 1. Open projects panel
  await page.getByTestId('nav-projects').click();
  const projectsPanel = page.getByTestId('panel-projects');
  await expect(projectsPanel).toBeVisible({ timeout: 10000 });

  // 2. Click the specific "New Project" button in the flyout (using unique test ID)
  // Use a more robust locator that looks specifically for the button in the open flyout
  const newProjectBtn = projectsPanel.getByTestId('btn-create-new-project')
      .or(projectsPanel.locator('button:has-text("New Project")'))
      .first();
      
  await newProjectBtn.waitFor({ state: 'visible', timeout: 10000 });
  await newProjectBtn.click();
  await page.waitForTimeout(1000);

  // 3. Fill in the project settings form
  const nameInput = page.getByTestId('project-name-input');
  await nameInput.waitFor({ state: 'visible', timeout: 5000 });
  await nameInput.fill(name);
  
  const descInput = page.getByTestId('project-goal-input'); // This matches the ID in SidebarFlyout.tsx
  await descInput.fill(description);

  // 4. Submit
  const saveBtn = page.getByTestId('save-project-settings');
  await saveBtn.click();
  
  // Wait for the dialog to close and the project to be created
  await page.waitForTimeout(2000);
}

/**
 * Navigate to the Global Settings page using the sidebar navigation
 */
export async function navigateToSettings(page: Page) {
  const settingsBtn = page.getByTestId('nav-settings');
  await expect(settingsBtn).toBeVisible({ timeout: 10000 });
  await settingsBtn.click();
  
  // Wait for settings page to be visible
  const settingsPage = page.getByTestId('settings-page');
  await expect(settingsPage).toBeVisible({ timeout: 15000 });
}
