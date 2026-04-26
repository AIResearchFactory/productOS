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
    const aboutNav = page.getByTestId('settings-nav-about');
    await expect(aboutNav).toBeVisible({ timeout: 10000 });
    await aboutNav.click();

    // Verify section heading or content updated
    await expect(page.getByText(/About productOS/i).first()).toBeVisible({ timeout: 15000 });
    // Verify specific about content to ensure section is correct
    await expect(page.getByText(/Platform version/i).first()).toBeVisible();
  });


  test('models/providers panel is accessible', async ({ page }) => {
    await page.getByTestId('nav-models').click();

    // Models flyout should open
    const activeProvider = page.getByText('Active Provider');
    await expect(activeProvider).toBeVisible({ timeout: 10000 });

    // Should have "Open Model Settings" button (which now switches section)
    const openSettingsBtn = page.getByRole('button', { name: /Model Settings|Open Model Settings/i }).first();
    await expect(openSettingsBtn).toBeVisible({ timeout: 10000 });
    await openSettingsBtn.click();
    
    // Verify we landed on AI & Models section
    await expect(page.getByRole('heading', { name: 'AI & Models' }).first()).toBeVisible();
  });

  test('settings integrations tab is accessible', async ({ page }) => {
    await navigateToSettings(page);

    const integrationsTab = page.getByTestId('settings-nav-integrations');
    await expect(integrationsTab).toBeVisible({ timeout: 10000 });
    await integrationsTab.click();
    
    // Verified transition to integrations - check for unique content
    await expect(page.getByText(/Connect to Telegram, WhatsApp/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('chat provider switch is reflected in the UI and persisted settings', async ({ page }) => {
    const optionLabels: Record<string, string> = {
      hostedApi: 'Claude API',
      ollama: 'Ollama',
      claudeCode: 'Claude CLI',
      geminiCli: 'Google',
      openAiCli: 'OpenAI',
      liteLlm: 'LiteLLM',
      autoRouter: 'Auto-Router',
    };

    const triggerLabels: Record<string, string> = {
      hostedApi: 'Claude API',
      ollama: 'Ollama Local',
      claudeCode: 'Claude Code CLI',
      geminiCli: 'Google',
      openAiCli: 'OpenAI',
      liteLlm: 'LiteLLM Router',
      autoRouter: 'Auto-Router (Rules)',
    };

    const state = await page.evaluate(async () => {
      const api = (window as any).appApi;
      return {
        settings: await api.getGlobalSettings(),
        providers: await api.listAvailableProviders(),
      };
    });

    const initialProvider = state.settings.activeProvider;
    const targetProvider = state.providers.find((provider: string) => provider !== initialProvider);

    expect(targetProvider).toBeTruthy();

    const providerCombo = page.locator('button[role="combobox"]').nth(1);
    await providerCombo.evaluate((el: HTMLElement) => el.click());

    const option = page.getByRole('option', {
      name: new RegExp(optionLabels[targetProvider!] || targetProvider!, 'i'),
    });
    await option.waitFor({ state: 'visible', timeout: 10000 });
    await option.click();
    await page.waitForTimeout(2000);

    const persistedSettings = await page.evaluate(async () => {
      return await (window as any).appApi.getGlobalSettings();
    });
    expect(persistedSettings.activeProvider).toBe(targetProvider);
    await expect(providerCombo).toContainText(triggerLabels[targetProvider!] || targetProvider!);

    await navigateToSettings(page);
    await page.getByTestId('settings-nav-ai').click();
    await expect(page.getByRole('heading', { name: 'AI & Models' }).first()).toBeVisible();

    const settingsValue = await page.evaluate(async () => {
      return (await (window as any).appApi.getGlobalSettings()).activeProvider;
    });
    expect(settingsValue).toBe(targetProvider);
  });

});
