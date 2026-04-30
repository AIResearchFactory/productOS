import { test, expect, type Page } from '@playwright/test';
import { skipSetupAndReach, createProjectViaUI, deleteProjectViaUI } from './helpers';

test.describe('productOS browser-first app', () => {

  test('onboarding flow: full setup', async ({ page }) => {
    // Force "first install" mode by mocking the API response
    await page.route('**/api/system/first-install', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(true),
    }));

    // Clear localStorage to ensure we start from the beginning
    await page.addInitScript(() => {
      localStorage.clear();
    });

    await page.goto('/');

    // Handle potential start at either Welcome or any Setup screen (InstallationWizard)
    const wizardWelcome = page.getByRole('heading', { name: 'Setup productOS' });
    const directoryHeading = page.getByRole('heading', { name: 'Workspace Location' });
    const providersHeading = page.getByRole('heading', { name: 'Select Your AI Providers' });
    
    // Wait for the wizard to appear
    await expect(wizardWelcome.or(directoryHeading).or(providersHeading)).toBeVisible({ timeout: 45000 });
    
    // Navigate through the wizard until we reach Providers
    let attempts = 0;
    while (attempts < 5) {
      if (await providersHeading.first().isVisible()) break;
      
      const continueBtn = page.getByRole('button', { name: 'Continue' });
      if (await continueBtn.isVisible()) {
        await continueBtn.click();
      } else {
        const useDefaultBtn = page.getByRole('button', { name: 'Use Default' });
        if (await useDefaultBtn.isVisible()) {
            await useDefaultBtn.click();
        }
      }
      await page.waitForTimeout(500);
      attempts++;
    }

    await expect(providersHeading.first()).toBeVisible({ timeout: 30000 });

    // Select a provider and continue
    await page.getByRole('button', { name: /OpenAI/ }).first().click();
    await page.getByRole('button', { name: 'Continue' }).click();

    // Handle potential "Install Dependencies" / "instructions" step
    const personalizationInput = page.getByTestId('personal-product-name');
    const instructionsHeading = page.getByRole('heading', { name: 'Install Dependencies' });
    
    await expect(personalizationInput.or(instructionsHeading)).toBeVisible({ timeout: 30000 });

    if (await instructionsHeading.isVisible()) {
        console.log('[E2E] On instructions step, clicking Continue...');
        await page.getByRole('button', { name: 'Continue' }).click();
    }

    // Step 4: Personalization (Project creation)
    await expect(personalizationInput).toBeVisible({ timeout: 30000 });
    const pName = `Full Setup Project ${Date.now()}`;
    await personalizationInput.clear();
    await personalizationInput.fill(pName);
    await page.getByTestId('personal-product-goal').fill('Verify full onboarding flow robustness');

    await page.getByRole('button', { name: 'Continue' }).click();

    // Final Step: Completion
    await expect(page.getByRole('heading', { name: "You're All Set!" })).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: 'Launch Workspace' }).click();

    // Verify we reached the workspace
    await expect(page.getByTestId('sidebar-navigation')).toBeVisible({ timeout: 60000 });
    
    // Ensure the products panel is open to see the project list
    const navProducts = page.getByTestId('nav-products');
    await navProducts.click({ force: true });
    
    const projectsPanel = page.getByTestId('panel-projects');
    await expect(projectsPanel).toBeVisible({ timeout: 15000 });
    // Wait for the project to appear in the sidebar
    console.log(`[E2E] Verifying project appearance in sidebar for ${pName}...`);
    const projectItem = page.getByTestId(`project-item-${pName}`).first();
    await projectItem.scrollIntoViewIfNeeded();
    await projectItem.waitFor({ state: 'visible', timeout: 45000 });
    await expect(projectItem).toBeVisible({ timeout: 15000 });
    console.log(`[E2E] Project ${pName} created and verified.`);
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
    await expect(page.getByText(projectName).first()).toBeVisible();

    // Delete it
    await deleteProjectViaUI(page, projectName);

    // Verify it's gone
    await expect(page.getByTestId('sidebar-navigation').getByText(projectName)).not.toBeVisible({ timeout: 15000 });
  });
});
