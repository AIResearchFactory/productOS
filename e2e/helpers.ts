import { test, expect, type Page } from '@playwright/test';

/**
 * Standard setup for functional E2E tests: bypasses onboarding and waits for 
 * key workspace elements to be visible.
 *
 * Uses page.addInitScript so localStorage values are set BEFORE the app boots,
 * eliminating the race condition where the server-health check runs before the
 * test flags are present.
 */
export async function skipSetupAndReach(page: Page) {
  // 1. Set localStorage BEFORE any navigation using addInitScript.
  //    This guarantees the values are present when the app's useEffect runs.
  await page.addInitScript(() => {
    localStorage.setItem('productOS_mock_onboarding', 'false');
    localStorage.setItem('productOS_runtime_initialized', 'true');
  });

  // 2. Navigate to the app
  await page.goto('/');

  // 3. Wait for the "Initializing" spinner to disappear (if it appears) and
  //    the main shell to be visible.
  await page.locator('text=Initializing productOS…').waitFor({ state: 'detached', timeout: 120000 }).catch(() => {});

  // 4. Wait for the main app container to be ready
  const appReady = page.getByTestId('app-ready');
  await expect(appReady).toBeVisible({ timeout: 120000 });

  // 5. Ensure the products nav tab is visible (primary nav item)
  const navProjects = page.getByTestId('nav-products');
  // High timeout because CI environment (especially macOS) can have slow startup
  await expect(navProjects).toBeVisible({ timeout: 120000 });
  await navProjects.waitFor({ state: 'visible' });
}

/** 
 * Create a project through the UI by clicking "New Project" in the sidebar 
 */
export async function createProjectViaUI(page: Page, name: string, description: string) {
  // 1. Open projects panel
  await page.getByTestId('nav-products').click();
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
  
  // 5. Ensure the project appears in the sidebar list
  // This verifies that both the API call succeeded and the event reached the UI
  const projectItem = page.getByTestId('panel-projects').getByText(name).first();
  await expect(projectItem).toBeVisible({ timeout: 30000 });
  
  // Small grace period for state to settle
  await page.waitForTimeout(1000);
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
