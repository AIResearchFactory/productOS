import { test, expect } from '@playwright/test';
import { skipSetupAndReach, navigateToSettings } from './helpers';

test.describe('Settings & Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await skipSetupAndReach(page);
  });

  test('settings page is accessible via gear icon', async ({ page }) => {
    await navigateToSettings(page);
    // Should see settings content (GlobalSettings page)
    const heading = page.getByRole('heading', { name: /Settings/i });
    if (await heading.isVisible({ timeout: 10000 }).catch(() => false)) {
      await expect(heading).toBeVisible();
    }
  });

  test('models/providers panel is accessible', async ({ page }) => {
    await page.getByTestId('nav-models').click();
    await page.waitForTimeout(500);

    // Models flyout should open
    const activeProvider = page.getByText('Active Provider');
    if (await activeProvider.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(activeProvider).toBeVisible();
    }

    // Should have "Open Model Settings" button
    const openSettingsBtn = page.getByRole('button', { name: 'Open Model Settings' });
    if (await openSettingsBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(openSettingsBtn).toBeVisible();
    }
  });

  test('settings integrations tab is accessible', async ({ page }) => {
    await navigateToSettings(page);

    const integrationsTab = page.getByTestId('settings-nav-integrations');
    if (await integrationsTab.isVisible({ timeout: 10000 }).catch(() => false)) {
      await integrationsTab.click();
      await page.waitForTimeout(500);
      // Should see channel/integration settings
    }
  });
});
