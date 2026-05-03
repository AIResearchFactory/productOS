import { test, expect } from '@playwright/test';
import { skipSetupAndReach } from './helpers';

test.describe('Billing & Usage E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Reach the workspace
    await skipSetupAndReach(page);
    
    // Ensure we have at least one project
    const projectCount = await page.getByTestId(/project-item-/).count();
    if (projectCount === 0) {
      await page.getByTestId('btn-create-new-project').click();
      await page.getByPlaceholder('Project name').fill('Usage Test Project');
      await page.getByRole('button', { name: /Create|Save/i }).click();
      await expect(page.getByTestId('project-item-Usage Test Project')).toBeVisible({ timeout: 10000 });
    }
  });

  test('should display consistent cost between sidebar and usage page', async ({ page }) => {
    // 1. Open Models tab in sidebar
    await page.getByTestId('nav-models').click();
    
    // 2. Wait for cost summary to appear
    const sidebarCostElement = page.getByTestId('sidebar-product-total');
    await expect(sidebarCostElement).toBeVisible({ timeout: 10000 });
    
    const sidebarCostText = await sidebarCostElement.innerText();
    console.log(`Sidebar cost: ${sidebarCostText}`);
    
    // 3. Click "View more"
    await page.getByTestId('sidebar-view-more-usage').click();
    
    // 4. Verify we are on the usage settings page
    await expect(page.getByTestId('settings-nav-usage')).toHaveAttribute('class', /bg-primary/);
    
    // 5. Verify the total cost matches
    const usageTotalCostElement = page.getByTestId('usage-total-cost');
    await expect(usageTotalCostElement).toBeVisible({ timeout: 10000 });
    
    const usageCostText = await usageTotalCostElement.innerText();
    console.log(`Usage page cost: ${usageCostText}`);
    
    // The sidebar has "$" prefix, usage page has "$" prefix too (from my edit)
    expect(usageCostText).toBe(sidebarCostText);
  });
});
