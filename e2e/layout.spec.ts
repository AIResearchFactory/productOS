import { test, expect } from '@playwright/test';
import { skipSetupAndReach, createProjectViaUI, deleteProjectViaUI } from './helpers';

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const metrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));

  expect(Math.max(metrics.documentWidth, metrics.bodyWidth)).toBeLessThanOrEqual(metrics.viewport + 2);
}

test.describe('Responsive Layout', () => {
  test.beforeEach(async ({ page }) => {
    await skipSetupAndReach(page);
  });

  test('sidebar renders all navigation items', async ({ page }) => {
    await expect(page.getByTestId('nav-products')).toBeVisible();
    await expect(page.getByTestId('nav-skills')).toBeVisible();
    await expect(page.getByTestId('nav-artifacts')).toBeVisible();
    await expect(page.getByTestId('nav-workflows')).toBeVisible();
    await expect(page.getByTestId('nav-models')).toBeVisible();
  });

  test('navigation tabs switch content panels', async ({ page }) => {
    // Click nav-products to toggle switcher
    const navProducts = page.getByTestId('nav-products');
    await navProducts.click();
    await expect(page.getByTestId('topbar-product-switcher')).toBeVisible();
    await navProducts.click({ force: true });
    await expect(page.getByTestId('topbar-product-switcher')).not.toBeVisible();

    // Click nav-skills to toggle skills panel (starts closed)
    const navSkills = page.getByTestId('nav-skills');
    await expect(page.getByTestId('panel-skills')).not.toBeVisible();
    await navSkills.click();
    await expect(page.getByTestId('panel-skills')).toBeVisible();

    // Click nav-workflows to toggle workflows panel (starts closed)
    const navWorkflows = page.getByTestId('nav-workflows');
    await expect(page.getByTestId('panel-workflows')).not.toBeVisible();
    await navWorkflows.click();
    await expect(page.getByTestId('panel-workflows')).toBeVisible();

    // Click nav-models to toggle models panel (starts closed)
    const navModels = page.getByTestId('nav-models');
    await expect(page.getByTestId('panel-models')).not.toBeVisible();
    await navModels.click();
    await expect(page.getByTestId('panel-models')).toBeVisible();

    // Click nav-artifacts to toggle artifacts panel (starts open)
    const navArtifacts = page.getByTestId('nav-artifacts');
    await expect(page.getByTestId('panel-artifacts')).toBeVisible();
    await navArtifacts.click();
    await expect(page.getByTestId('panel-artifacts')).not.toBeVisible();
  });

  test('app layout is readable at narrow desktop width', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });

    // All nav items should still be visible
    await expect(page.getByTestId('nav-products')).toBeVisible();
    await expect(page.getByTestId('nav-workflows')).toBeVisible();

    // Navigate through tabs at narrow width
    await page.getByTestId('nav-workflows').click();
    await page.waitForTimeout(500);
    await page.getByTestId('nav-artifacts').click();
    await page.waitForTimeout(500);
  });

  test('app layout adapts to wide desktop width', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    await expect(page.getByTestId('nav-products')).toBeVisible();
    await expect(page.getByTestId('nav-artifacts')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('product home remains usable across mobile, tablet, and desktop widths', async ({ page }) => {
    const productName = `Responsive Product ${Date.now()}`;
    await createProjectViaUI(page, productName, 'Verify responsive product home layout and color contrast');

    const closeFlyout = page.getByTestId('flyout-close-button');
    if (await closeFlyout.isVisible()) {
      await closeFlyout.click();
    }

    for (const size of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(size);
      await expect(page.getByTestId('product-home')).toBeVisible({ timeout: 20000 });
      await expect(page.getByRole('heading', { name: productName })).toBeVisible();
      await expect(page.getByText('Next best action')).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }

    await deleteProjectViaUI(page, productName);
  });
});
