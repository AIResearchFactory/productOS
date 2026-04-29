import { test, expect } from '@playwright/test';
import { deleteProjectViaUI, disableAnimations, ensureChatVisible } from './helpers';

test.describe('productOS browser-first app', () => {
  test.beforeEach(async ({ page }) => {
    await disableAnimations(page);
  });

  test('shows installation wizard and allows browser-first skip', async ({ page }) => {
    await page.goto('/');

    // Wait for the wizard to mount and be visible
    const welcomeTitle = page.getByTestId('wizard-welcome-title');
    await expect(welcomeTitle).toBeVisible({ timeout: 30000 });
    await expect(welcomeTitle).toHaveText(/Setup productOS/i);

    const skipBtn = page.getByTestId('wizard-skip-button');
    await expect(skipBtn).toBeVisible();
    await skipBtn.click({ force: true });

    // Verify main workspace loads
    await expect(page.getByTestId('workspace-layout')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('nav-products')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('nav-skills')).toBeVisible();
    await expect(page.getByTestId('nav-artifacts')).toBeVisible();
    await expect(page.getByTestId('nav-workflows')).toBeVisible();
    await expect(page.getByTestId('nav-models')).toBeVisible();

    // Verify navigation works
    await page.getByTestId('nav-workflows').click();
    await expect(page.getByTestId('panel-workflows')).toBeVisible({ timeout: 10000 });

    await page.getByTestId('nav-skills').click();
    await expect(page.getByTestId('panel-skills')).toBeVisible({ timeout: 10000 });
  });

  test('onboarding flow: full setup', async ({ page }) => {
    await page.goto('/');

    // 1. Verify we can see the wizard
    await expect(page.getByTestId('wizard-welcome-title')).toBeVisible({ timeout: 30000 });
    
    // Step 1: Welcome -> Location
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Workspace Location')).toBeVisible({ timeout: 10000 });

    // Step 2: Location -> Data
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Research Data & Projects')).toBeVisible({ timeout: 10000 });

    // Step 3: Data -> Providers
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Select Your AI Providers' }).first()).toBeVisible({ timeout: 60000 });

    // Select a provider and continue
    await page.getByRole('button', { name: /OpenAI/ }).first().click();
    await page.getByRole('button', { name: 'Continue' }).click();

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

    // 4. Verify main workspace loads
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('workspace-layout')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('nav-products')).toBeVisible({ timeout: 30000 });
    
    // Open the projects flyout if not already open
    const projectsPanel = page.getByTestId('panel-projects');
    const isVisible = await projectsPanel.isVisible().catch(() => false);
    if (!isVisible) {
        await page.getByTestId('nav-products').click({ force: true });
    }
    await expect(projectsPanel).toBeVisible({ timeout: 15000 });

    // Verify the project appears in the sidebar
    const projectItem = projectsPanel.getByText(pName, { exact: true }).first();
    await expect(projectItem).toBeVisible({ timeout: 30000 });

    // Ensure chat is visible for the next step
    await ensureChatVisible(page);

    // Verify Sidebar navigation to Models
    await page.getByTestId('nav-models').click();
    await expect(page.getByRole('heading', { name: 'Models' })).toBeVisible({ timeout: 15000 });

    // Cleanup
    await deleteProjectViaUI(page, pName);
  });
});
