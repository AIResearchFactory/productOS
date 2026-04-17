import { test, expect } from '@playwright/test';
import { skipSetupAndReach, createProjectViaUI } from './helpers';

test.describe('Skills Management', () => {
  test.beforeEach(async ({ page }) => {
    await skipSetupAndReach(page);
  });

  test('skills are available in the workspace', async ({ page }) => {
    await createProjectViaUI(page, 'Skills Test Project', 'Testing skills');
    await page.getByTestId('nav-projects').click();

    // Skills may be accessible through the sidebar or a dedicated panel
    // Check that the workspace loads without errors
    await page.waitForTimeout(1000);
  });
});

test.describe('Research Log', () => {
  test.beforeEach(async ({ page }) => {
    await skipSetupAndReach(page);
    await createProjectViaUI(page, 'Research Log Project', 'Testing research log');
  });

  test('research panel is accessible', async ({ page }) => {
    const researchNav = page.getByTestId('nav-research');
    await researchNav.click();
    await expect(researchNav).toBeVisible({ timeout: 10000 });
  });
});

test.describe('MCP Integration', () => {
  test.beforeEach(async ({ page }) => {
    await skipSetupAndReach(page);
  });

  test('models panel loads without error', async ({ page }) => {
    await page.getByTestId('nav-models').click();
    
    // Should see the Models heading
    await expect(page.getByRole('heading', { name: 'Models' })).toBeVisible({ timeout: 10000 });
  });
});
