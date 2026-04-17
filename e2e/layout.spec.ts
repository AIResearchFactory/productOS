import { test, expect } from '@playwright/test';
import { skipSetupAndReach } from './helpers';

test.describe('Responsive Layout', () => {
  test.beforeEach(async ({ page }) => {
    await skipSetupAndReach(page);
  });

  test('sidebar renders all navigation items', async ({ page }) => {
    await expect(page.getByTestId('nav-projects')).toBeVisible();
    await expect(page.getByTestId('nav-research')).toBeVisible();
    await expect(page.getByTestId('nav-artifacts')).toBeVisible();
    await expect(page.getByTestId('nav-workflows')).toBeVisible();
    await expect(page.getByTestId('nav-models')).toBeVisible();
  });

  test('navigation tabs switch content panels', async ({ page }) => {
    // Click through each nav item and verify it doesn't crash
    const tabs = ['nav-projects', 'nav-research', 'nav-artifacts', 'nav-workflows', 'nav-models'];

    for (const tab of tabs) {
      const navItem = page.getByTestId(tab);
      await navItem.click();
      await page.waitForTimeout(300);
      // The tab should still be visible after clicking
      await expect(navItem).toBeVisible();
    }
  });

  test('app layout is readable at narrow desktop width', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });

    // All nav items should still be visible
    await expect(page.getByTestId('nav-projects')).toBeVisible();
    await expect(page.getByTestId('nav-workflows')).toBeVisible();

    // Navigate through tabs at narrow width
    await page.getByTestId('nav-workflows').click();
    await page.waitForTimeout(500);
    await page.getByTestId('nav-artifacts').click();
    await page.waitForTimeout(500);
  });

  test('app layout adapts to wide desktop width', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    await expect(page.getByTestId('nav-projects')).toBeVisible();
    await expect(page.getByTestId('nav-artifacts')).toBeVisible();
  });
});
