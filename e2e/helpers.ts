import { test, expect, type Page } from '@playwright/test';

/**
 * Shared test helpers for productOS E2E tests.
 * All tests assume the browser-first (non-Tauri) runtime.
 */

/** Skip onboarding and reach the main workspace shell */
export async function skipSetupAndReach(page: Page) {
  await page.goto('/');

  // Skip onboarding via localStorage bypass
  await page.evaluate(() => {
    localStorage.setItem('productOS_mock_onboarding', 'false');
  });

  // Reload to apply changes if needed, but usually the app reads it on mount
  await page.goto('/');

  // Wait for the main shell to be fully visible
  try {
    await expect(page.getByTestId('nav-projects')).toBeVisible({ timeout: 15000 });
  } catch (e) {
    // Fallback: search for skip button if localStorage didn't work
    const skipLabels = ['Skip Setup', 'Skip to App', 'Get Started'];
    for (const label of skipLabels) {
      const btn = page.getByRole('button', { name: label });
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn.click();
        break;
      }
    }
    await expect(page.getByTestId('nav-projects')).toBeVisible({ timeout: 10000 });
  }
}

/** Create a project through the UI by clicking "New Project" in the sidebar
 * and filling in the project settings form. */
export async function createProjectViaUI(page: Page, name: string, goal: string) {
  // 1. Click Projects tab to open the flyout if it's not already open
  const projectsPanel = page.getByTestId('panel-projects');
  const isPanelOpen = await projectsPanel.isVisible().catch(() => false);
  if (!isPanelOpen) {
    await page.getByTestId('nav-projects').click();
  }
  await projectsPanel.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(500);


  // 2. Click the specific "New Project" button in the flyout (using unique test ID)
  const newProjectBtn = page.getByTestId('btn-create-new-project');
  await newProjectBtn.waitFor({ state: 'visible', timeout: 5000 });
  await newProjectBtn.click();
  await page.waitForTimeout(500);

  // 3. Fill in the project settings form
  const nameInput = page.getByTestId('project-name-input');
  await nameInput.waitFor({ state: 'visible', timeout: 8000 });
  
  // Clear if necessary
  await nameInput.clear().catch(() => {});
  await nameInput.fill(name);

  const goalInput = page.getByTestId('project-goal-input');
  await goalInput.clear().catch(() => {});
  await goalInput.fill(goal);

  try {
    // 4. Click Save
    const saveBtn = page.getByTestId('save-project-settings');
    await saveBtn.click();
    // Wait for the dialog to close and the project to be created
    await page.waitForTimeout(2000);
  } catch (e) {
    console.error('Project save failed:', e);
  }
}

/** Navigate to a specific settings area */
export async function navigateToSettings(page: Page) {
  // Settings is accessed via the gear icon in the sidebar bottom
  const settingsBtn = page.getByRole('button', { name: 'Settings' }).or(page.locator('button[title="Settings"]'));
  
  await expect(settingsBtn).toBeVisible({ timeout: 15000 });
  
  // Retry click if navigation doesn't happen immediately
  for (let i = 0; i < 3; i++) {
    await settingsBtn.click({ force: true });
    try {
      await page.waitForSelector('[data-testid="settings-page"]', { timeout: 5000 });
      break;
    } catch (e) {
      if (i === 2) throw new Error("Failed to navigate to settings page after 3 attempts");
      await page.waitForTimeout(1000);
    }
  }

  await page.waitForTimeout(500);
}
