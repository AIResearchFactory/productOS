import { test, expect, type Page } from '@playwright/test';
import { skipSetupAndReach, createProjectViaUI, deleteProjectViaUI } from './helpers';

test.describe('productOS browser-first app', () => {

  test('onboarding flow: full setup', async ({ page }) => {
    // We don't call skipSetupAndReach here because we want to test the full flow
    await page.goto('/');

    // Ensure we are on the onboarding page
    await expect(page.getByRole('heading', { name: 'Welcome to productOS' })).toBeVisible({ timeout: 30000 });

    // Step 1: Welcome -> Data Privacy
    await page.getByRole('button', { name: 'Get Started' }).click();
    await expect(page.getByRole('heading', { name: 'Your Data, Your Control' })).toBeVisible({ timeout: 15000 });

    // Step 2: Data -> Providers
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Select Your AI Providers' }).first()).toBeVisible({ timeout: 60000 });

    // Select a provider and continue
    await page.getByRole('button', { name: /OpenAI/ }).first().click();
    await page.getByRole('button', { name: 'Continue' }).click();

    // Handle potential "Install Dependencies" / "instructions" step if tools are missing in CI
    const personalizationInput = page.getByTestId('personal-product-name');
    try {
        await personalizationInput.waitFor({ state: 'visible', timeout: 5000 });
    } catch (e) {
        console.log('[E2E] Personalization not visible, checking for Instructions/Install step...');
        const continueBtn = page.getByRole('button', { name: 'Continue' });
        if (await continueBtn.isVisible()) {
            await continueBtn.click();
        }
    }

    // Step 4: Providers -> Personalization (Project creation)
    await expect(page.getByTestId('personal-product-name')).toBeVisible({ timeout: 30000 });
    const pName = `Full Setup Project ${Date.now()}`;
    await page.getByTestId('personal-product-name').clear();
    await page.getByTestId('personal-product-name').fill(pName);
    await page.getByTestId('personal-product-goal').fill('Verify full onboarding flow robustness');

    await page.getByRole('button', { name: 'Continue' }).click();

    // Final Step: Completion
    await expect(page.getByRole('heading', { name: "You're All Set!" })).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: 'Launch Workspace' }).click();

    // Verify we reached the workspace
    await expect(page.getByTestId('workspace-layout')).toBeVisible({ timeout: 30000 });
    
    // Verify our project was created and is active
    await expect(page.getByText(pName)).toBeVisible({ timeout: 15000 });
  });

  test('workspace navigation and core panels', async ({ page }) => {
    await skipSetupAndReach(page);

    // Sidebar should be visible
    const sidebar = page.getByTestId('sidebar-navigation');
    await expect(sidebar).toBeVisible();

    // Navigate through tabs
    const tabs = ['products', 'skills', 'artifacts', 'workflows', 'models'];
    for (const tab of tabs) {
      const navBtn = page.getByTestId(`nav-${tab}`);
      await expect(navBtn).toBeVisible();
      await navBtn.click();
      
      // Flyout should open
      const flyoutHeader = page.getByTestId('sidebar-flyout-header');
      await expect(flyoutHeader).toBeVisible();
    }
  });

  test('project lifecycle: create and delete', async ({ page }) => {
    await skipSetupAndReach(page);

    const projectName = `Test Project ${Date.now()}`;
    await createProjectViaUI(page, projectName);

    // Verify it exists in the sidebar
    await expect(page.getByText(projectName)).toBeVisible();

    // Delete it
    await deleteProjectViaUI(page, projectName);

    // Verify it's gone
    await expect(page.getByText(projectName)).not.toBeVisible({ timeout: 15000 });
  });
});
