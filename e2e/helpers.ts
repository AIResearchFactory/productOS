import { test, expect, type Page } from '@playwright/test';

export async function disableAnimations(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        animation-iteration-count: 1 !important;
      }
    `
  });
}

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
    localStorage.setItem('productOS_animations_disabled', 'true');
  });

  // 2. Navigate to the app
  await page.goto('/');

  // 3. Disable animations for stability
  await disableAnimations(page);

  // 4. Wait for the core workspace elements
  await expect(page.getByTestId('workspace-layout')).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId('sidebar-navigation')).toBeVisible({ timeout: 30000 });

  // 5. Ensure the products nav tab is visible (primary nav item)
  const navProjects = page.getByTestId('nav-products');
  // High timeout because CI environment (especially macOS) can have slow startup
  await expect(navProjects).toBeVisible({ timeout: 120000 });
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
  await page.waitForTimeout(500);

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

/**
 * Delete a project through the UI context menu
 */
export async function deleteProjectViaUI(page: Page, name: string) {
  // 1. Open projects panel
  await page.getByTestId('nav-products').click();
  const projectsPanel = page.getByTestId('panel-projects');
  await expect(projectsPanel).toBeVisible({ timeout: 10000 });

  // 2. Right click the project item to open context menu
  const projectItem = projectsPanel.getByText(name, { exact: true });
  await projectItem.waitFor({ state: 'visible', timeout: 10000 });
  await projectItem.click({ button: 'right', force: true });

  // 3. Click "Delete Product" in context menu
  const deleteBtn = page.locator('div[role="menuitem"]:has-text("Delete Product")');
  
  await deleteBtn.click();

  // 4. Confirm in the UI dialog
  const confirmBtn = page.getByRole('button', { name: 'Delete', exact: true });
  await expect(confirmBtn).toBeVisible({ timeout: 5000 });
  await confirmBtn.click();

  // Wait for it to be removed
  await expect(projectItem).not.toBeVisible({ timeout: 10000 });
}
