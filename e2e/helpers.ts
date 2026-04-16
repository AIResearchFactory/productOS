import { test, expect, type Page } from '@playwright/test';

/**
 * Shared test helpers for productOS E2E tests.
 * All tests assume the browser-first (non-Tauri) runtime.
 */

/** Skip onboarding and reach the main workspace shell */
export async function skipSetupAndReach(page: Page) {
  await page.goto('/');

  // Robust skip logic for multiple possible button labels
  const skipLabels = ['Skip Setup', 'Skip to App', 'Get Started'];
  for (const label of skipLabels) {
    const btn = page.getByRole('button', { name: label });
    if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await btn.click();
      break;
    }
  }


  // Wait for the main shell to be fully visible
  await expect(page.getByTestId('nav-projects')).toBeVisible({ timeout: 20000 });
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
  
  // Clear if necessary (as per Assaf's recent fix)
  await nameInput.clear().catch(() => {});
  await nameInput.fill(name);

    const goalInput = page.getByTestId('project-goal-input');
    await goalInput.clear();
    await goalInput.fill(goal);

  try{
    // 4. Click Save
    const saveBtn = page.getByTestId('save-project-settings');
    await saveBtn.click();
    // Wait for the dialog to close and the project to be created
    await page.waitForTimeout(2000);
  } catch (e) {
    console.error('Project name input not found or failed to fill');
  }
}



/** Navigate to a specific settings area */
export async function navigateToSettings(page: Page) {
  // Settings is accessed via the gear icon in the sidebar bottom
  // Navigate to settings rail button
  const settingsBtn = page.getByRole('button', { name: 'Settings' }).or(page.locator('button[title="Settings"]'));
  try {
    await settingsBtn.waitFor({ state: 'visible', timeout: 10000 });
    await settingsBtn.click();
    // Wait for settings page to load in MainPanel
    await page.waitForSelector('[data-testid="settings-page"]', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);
  } catch (e) {
    // maybe already there or icon changed
  }

  await page.waitForTimeout(1000);
}
