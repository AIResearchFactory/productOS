import { test, expect } from '@playwright/test';

test.describe('productOS browser-first app', () => {
  test('shows installation wizard and allows browser-first skip', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Setup productOS')).toBeVisible();
    await expect(page.getByText('Skip Setup')).toBeVisible();

    await page.getByRole('button', { name: 'Skip Setup' }).click();

    await expect(page.getByTestId('nav-projects')).toBeVisible();
    await expect(page.getByTestId('nav-research')).toBeVisible();
    await expect(page.getByTestId('nav-artifacts')).toBeVisible();
    await expect(page.getByTestId('nav-workflows')).toBeVisible();
    await expect(page.getByTestId('nav-models')).toBeVisible();

    await page.getByTestId('nav-workflows').click();
    await expect(page.getByTestId('nav-workflows')).toBeVisible();

    await page.getByTestId('nav-artifacts').click();
    await expect(page.getByTestId('nav-artifacts')).toBeVisible();
  });

  test('can move through the browser-first setup flow', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Workspace Location')).toBeVisible();

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Research Data & Projects')).toBeVisible();

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Select Your AI Providers')).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: /OpenAI \(ChatGPT Login\)/ }).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    // If the provider is missing in the environment, it goes to instructions step
    await expect(page.getByText('Install Dependencies')).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByTestId('personal-product-name')).toBeVisible();
    await page.getByTestId('personal-product-name').fill('Playwright Project');
    await page.getByTestId('personal-product-goal').fill('Verify browser-first onboarding flow');

    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: "You're All Set!" })).toBeVisible();
    await page.getByRole('button', { name: 'Launch Workspace' }).click();

    await expect(page.getByTestId('nav-projects')).toBeVisible();
    await expect(page.getByText('Playwright Project')).toBeVisible();

    await page.getByTestId('nav-models').click();
    await expect(page.getByRole('heading', { name: 'Models' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open Model Settings' })).toBeVisible();
  });
});
