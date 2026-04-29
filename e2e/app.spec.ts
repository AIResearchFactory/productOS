import { test, expect } from '@playwright/test';
import { deleteProjectViaUI, disableAnimations } from './helpers';

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

    await expect(page.getByTestId('nav-products')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('nav-skills')).toBeVisible();
    await expect(page.getByTestId('nav-artifacts')).toBeVisible();
    await expect(page.getByTestId('nav-workflows')).toBeVisible();
    await expect(page.getByTestId('nav-models')).toBeVisible();

    await page.getByTestId('nav-workflows').click();
    await expect(page.getByTestId('nav-workflows')).toBeVisible();

    await page.getByTestId('nav-artifacts').click();
    await expect(page.getByTestId('nav-artifacts')).toBeVisible();
  });

  test('onboarding flow: full setup', async ({ page }) => {
    await page.goto('/');

    // 1. Verify we can see the wizard
    await expect(page.getByTestId('wizard-welcome-title')).toBeVisible({ timeout: 30000 });
    
    // We'll test the FULL SETUP flow first as it is more comprehensive.
    // If we reach the "You're All Set" screen, we've verified the wizard logic.
    
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Workspace Location')).toBeVisible();

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Research Data & Projects')).toBeVisible();

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Select Your AI Providers' }).first()).toBeVisible({ timeout: 60000 });

    await page.getByRole('button', { name: /OpenAI \(ChatGPT Login\)/ }).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    // Skip Dependencies step if shown
    try {
        await expect(page.getByText('Install Dependencies')).toBeVisible({ timeout: 2000 });
        await page.getByRole('button', { name: 'Continue' }).click();
    } catch (e) {}

    await expect(page.getByTestId('personal-product-name')).toBeVisible({ timeout: 30000 });
    await page.getByTestId('personal-product-name').clear();
    await page.getByTestId('personal-product-name').fill('Playwright Project');
    await page.getByTestId('personal-product-goal').fill('Verify browser-first onboarding flow');

    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: "You're All Set!" })).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: 'Launch Workspace' }).click();

    // 4. Verify main workspace loads
    // Wait for the URL to change and network to settle
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await expect(page.getByTestId('nav-products')).toBeVisible({ timeout: 30000 });
    
    // Open the projects flyout if not already open
    const projectsPanel = page.getByTestId('panel-projects');
    if (!(await projectsPanel.isVisible())) {
        await page.getByTestId('nav-products').click({ force: true });
    }
    await expect(projectsPanel).toBeVisible({ timeout: 15000 });

    // Verify the project appears in the sidebar
    await expect(projectsPanel.getByText('Playwright Project', { exact: true }).first()).toBeVisible({ timeout: 30000 });

    // Verify Sidebar navigation
    await page.getByTestId('nav-models').click();
    await expect(page.getByRole('heading', { name: 'Models' })).toBeVisible({ timeout: 15000 });

    // Cleanup
    await deleteProjectViaUI(page, 'Playwright Project');
  });
});
