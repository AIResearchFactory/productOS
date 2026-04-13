import { test, expect, type Page } from '@playwright/test';

/**
 * Shared test helpers for productOS E2E tests.
 * All tests assume the browser-first (non-Tauri) runtime.
 */

/** Skip onboarding and reach the main workspace shell */
export async function skipSetupAndReach(page: Page) {
  await page.goto('/');

  // If the setup wizard is showing, skip it
  const skipBtn = page.getByRole('button', { name: 'Skip Setup' });
  if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await skipBtn.click();
  }

  // Wait for the main shell to be visible
  await expect(page.getByTestId('nav-projects')).toBeVisible({ timeout: 15000 });
}

/** Create a project through the UI by clicking "New Product" in the sidebar
 * and filling in the project settings form. */
export async function createProjectViaUI(page: Page, name: string, goal: string) {
  // 1. Click the Products nav to open the flyout
  await page.getByTestId('nav-projects').click();
  await page.waitForTimeout(500);

  // 2. Click the "New Product" button in the flyout
  const newProductBtn = page.getByRole('button', { name: 'New Product' });
  await newProductBtn.waitFor({ state: 'visible', timeout: 5000 });
  await newProductBtn.click();
  await page.waitForTimeout(500);

  // 3. Fill in the project settings form
  const nameInput = page.getByTestId('project-name-input');
  if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await nameInput.fill(name);

    const goalInput = page.getByTestId('project-goal-input');
    await goalInput.fill(goal);

    // 4. Click Save
    const saveBtn = page.getByTestId('save-project-settings');
    await saveBtn.click();
    await page.waitForTimeout(1500);
  }
}

/** Navigate to a specific settings area */
export async function navigateToSettings(page: Page) {
  // Settings is accessed via the gear icon in the sidebar bottom
  const settingsBtn = page.locator('button[title="Settings"]');
  if (await settingsBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await settingsBtn.click();
  }
  await page.waitForTimeout(1000);
}
