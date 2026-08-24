import { test, expect } from '@playwright/test';
import { skipSetupAndReach, createProjectViaUI } from './helpers';

test.describe('Silent Learner demo readiness', () => {
  test.beforeEach(async ({ page }) => {
    await skipSetupAndReach(page);
  });

  test('project settings expose Silent Learner controls, privacy copy, and optimize feedback', async ({ page }, testInfo) => {
    const projectName = `Silent Learner E2E ${Date.now()}`;
    await createProjectViaUI(page, projectName, 'Validate Silent Learner demo readiness');

    const switcherPanel = page.getByTestId('topbar-product-switcher');
    if (await switcherPanel.isVisible().catch(() => false)) {
      await page.getByTestId('nav-products').click({ force: true });
      await expect(switcherPanel).toBeHidden({ timeout: 10000 });
    }

    const { closeAllDialogs } = await import('./helpers');
    await closeAllDialogs(page);

    const projectSettingsBtn = page.getByTestId('nav-project-settings');
    await expect(projectSettingsBtn).toBeVisible({ timeout: 15000 });
    await projectSettingsBtn.click();

    const settingsPage = page.getByTestId('project-settings-page');
    await expect(settingsPage).toBeVisible({ timeout: 20000 });

    const silentLearnerNav = settingsPage.getByRole('button', { name: /Silent Learner/i });
    await expect(silentLearnerNav).toBeVisible({ timeout: 15000 });
    await silentLearnerNav.click();

    await expect(page.getByRole('heading', { name: /Silent Learner/i }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Silent Learner Mode')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/100% on-device privacy/i).first()).toBeVisible();
    await expect(page.getByText('Workspace Mode & Status')).toBeVisible();
    await expect(page.getByText(/Observing|Silent Learner: Off|Memory Ready|Paused/i).first()).toBeVisible();

    await testInfo.attach('silent-learner-initial', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    const toggle = page.getByRole('switch', { name: /Toggle Silent Learner/i });
    await expect(toggle).toBeVisible();

    const isInitiallyChecked = await toggle.getAttribute('aria-checked');
    if (isInitiallyChecked === 'true') {
      await toggle.click();
      await expect(page.getByText('Silent Learner: Off')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/Boost AI Relevance/i)).toBeVisible();
    }

    await toggle.click();
    await expect(page.getByText('Observing')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /Optimize Memory/i })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /Optimize Memory/i }).click();
    await expect(page.getByText(/Cold-Start Optimize Scan Triggered|Scanning history files/i).first()).toBeVisible({ timeout: 10000 });

    await expect(page.getByText('Privacy & Memory Control')).toBeVisible();
    await expect(page.getByText(/Wipes all SQLite logs/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Export Pack/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Clear All Data/i })).toBeVisible();

    await testInfo.attach('silent-learner-observing-privacy', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
});
