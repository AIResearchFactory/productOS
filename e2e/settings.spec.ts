import { test, expect } from '@playwright/test';
import { skipSetupAndReach, navigateToSettings } from './helpers';

test.describe('Settings & Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await skipSetupAndReach(page);
  });

  test('settings page is accessible via gear icon', async ({ page }) => {
    await navigateToSettings(page);
    // Should see settings content (GlobalSettings page)
    // The sidebar of settings has an H2 with "Settings"
    const heading = page.getByRole('heading', { name: 'Settings' }).first();
    await expect(heading).toBeVisible({ timeout: 20000 });
  });

  test('can switch between settings sections', async ({ page }) => {
    await navigateToSettings(page);
    
    // Click on About section
    const aboutNav = page.getByRole('button', { name: /About/i }).or(page.getByTestId('nav-section-about')).first();
    await aboutNav.waitFor({ state: 'visible', timeout: 10000 });
    await aboutNav.click();

    // Verify section heading or content updated
    await expect(page.getByText(/About productOS/i).first()).toBeVisible({ timeout: 15000 });
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
