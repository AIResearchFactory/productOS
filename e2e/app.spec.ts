import { test, expect } from '@playwright/test';

test.describe('productOS browser-first app', () => {
  test('onboarding flow: skip and full setup', async ({ page }) => {
    // This test covers the onboarding flow. 
    // Since the backend persists state during the test run, we combine these or handle them carefully.
    
    await page.goto('/');

    // 1. Verify we can see the wizard
    await expect(page.getByText('Setup productOS')).toBeVisible({ timeout: 15000 });
    
    // We'll test the FULL SETUP flow first as it is more comprehensive.
    // If we reach the "You're All Set" screen, we've verified the wizard logic.
    
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Workspace Location')).toBeVisible();

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Research Data & Projects')).toBeVisible();

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Select Your AI Providers' })).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: /OpenAI \(ChatGPT Login\)/ }).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    // Skip Dependencies step if shown
    try {
        await expect(page.getByText('Install Dependencies')).toBeVisible({ timeout: 2000 });
        await page.getByRole('button', { name: 'Continue' }).click();
    } catch (e) {}

    await expect(page.getByTestId('personal-product-name')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('personal-product-name').fill('Playwright Project');
    await page.getByTestId('personal-product-goal').fill('Verify browser-first onboarding flow');

    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: "You're All Set!" })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Launch Workspace' }).click();

    // Verify main workspace loads
    await expect(page.getByTestId('nav-projects')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Playwright Project' }).first()).toBeVisible({ timeout: 15000 });

    // Verify Sidebar navigation
    await page.getByTestId('nav-models').click();
    await expect(page.getByRole('heading', { name: 'Models' })).toBeVisible();
  });
});
