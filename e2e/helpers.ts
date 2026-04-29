import { test, expect, type Page } from '@playwright/test';

export async function disableAnimations(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        animation-iteration-count: 1 !important;
      }
    `
  });
}

/**
 * Standard setup for functional E2E tests: bypasses onboarding and waits for 
 * key workspace elements to be visible.
 *
 * Uses page.addInitScript so localStorage values are set BEFORE the app boots,
 * eliminating the race condition where the server-health check runs before the
 * test flags are present.
 */
export async function skipSetupAndReach(page: Page) {
  // 1. Set localStorage BEFORE any navigation using addInitScript.
  //    This guarantees the values are present when the app's useEffect runs.
  await page.addInitScript(() => {
    localStorage.setItem('productOS_mock_onboarding', 'false');
    localStorage.setItem('productOS_runtime_initialized', 'true');
    localStorage.setItem('productOS_animations_disabled', 'true');
  });

  // 2. Navigate to the app
  await page.goto('/');

  // 3. Disable animations for stability
  await disableAnimations(page);

  // 4. Wait for the core workspace elements
  await expect(page.getByTestId('workspace-layout')).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId('sidebar-navigation')).toBeVisible({ timeout: 30000 });

  // 5. Ensure the products nav tab is visible (primary nav item)
  const navProjects = page.getByTestId('nav-products');
  // High timeout because CI environment (especially macOS) can have slow startup
  await expect(navProjects).toBeVisible({ timeout: 120000 });
}

/**
 * Ensures the chat panel is visible. If it's hidden (e.g. by a document), 
 * it clicks the "Show Chat" button.
 */
export async function ensureChatVisible(page: Page) {
  const chatInput = page.getByTestId('chat-input');
  
  // Give the app a moment to settle after any async state updates
  await page.waitForTimeout(1000);

  const isVisible = await chatInput.isVisible().catch(() => false);
  console.log(`[Helpers] Chat input isVisible: ${isVisible}`);
  
  if (!isVisible) {
    console.log('[Helpers] Chat input not visible, looking for "Show Chat" button...');
    const showChatBtn = page.getByRole('button', { name: /show chat/i }).first();
    
    try {
      if (await showChatBtn.isVisible()) {
        console.log('[Helpers] Clicking "Show Chat" button...');
        await showChatBtn.click({ force: true });
      } else {
        console.log('[Helpers] "Show Chat" button not visible, waiting for it...');
        await showChatBtn.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
        if (await showChatBtn.isVisible()) {
          await showChatBtn.click({ force: true });
        }
      }
    } catch (e) {
      console.log('[Helpers] Failed to show chat panel.');
    }
  }

  // Final check - this will wait if needed
  await expect(chatInput).toBeVisible({ timeout: 10000 });
}

/** 
 * Create a project through the UI by clicking "New Project" in the sidebar 
 */
export async function createProjectViaUI(page: Page, name: string, description: string) {
  console.log(`[E2E] Creating project: ${name}`);
  
  // 1. Ensure projects panel is open
  const navProducts = page.getByTestId('nav-products');
  await navProducts.waitFor({ state: 'visible', timeout: 15000 });
  
  // If panel is not visible, click it. If it is visible, don't click (otherwise it might close)
  const isPanelVisible = await page.getByTestId('panel-projects').isVisible().catch(() => false);
  if (!isPanelVisible) {
    await navProducts.click({ force: true });
  }
  
  const projectsPanel = page.getByTestId('panel-projects');
  await expect(projectsPanel).toBeVisible({ timeout: 15000 });

  // 2. Click the specific "New Project" button in the flyout (using unique test ID)
  const newProjectBtn = projectsPanel.getByTestId('btn-create-new-project')
      .or(projectsPanel.locator('button:has-text("New Project")'))
      .first();
      
  await newProjectBtn.waitFor({ state: 'visible', timeout: 10000 });
  await newProjectBtn.click({ force: true });

  // 3. Wait for the project settings page to be visible in the content area
  const settingsPage = page.getByTestId('project-settings-page');
  await expect(settingsPage).toBeVisible({ timeout: 15000 });

  // 4. Fill in the project settings form
  // Wait for the input to be specifically visible and interactive
  const nameInput = page.getByTestId('project-name-input');
  await nameInput.waitFor({ state: 'visible', timeout: 15000 });
  await nameInput.scrollIntoViewIfNeeded();
  await nameInput.fill(name, { force: true });
  
  const descInput = page.getByTestId('project-goal-input'); 
  await descInput.scrollIntoViewIfNeeded();
  await descInput.fill(description, { force: true });

  // 5. Submit
  const saveBtn = page.getByTestId('save-project-settings');
  await saveBtn.scrollIntoViewIfNeeded();
  await expect(saveBtn).toBeVisible({ timeout: 10000 });
  await saveBtn.click({ force: true });
  
  // 6. Wait for the project to appear in the sidebar
  // This verifies the creation was successful
  await expect(projectsPanel.getByText(name, { exact: true }).first()).toBeVisible({ timeout: 20000 });
}

/**
 * Navigate to the Global Settings page using the sidebar navigation
 */
export async function navigateToSettings(page: Page) {
  const settingsBtn = page.getByTestId('nav-settings');
  await expect(settingsBtn).toBeVisible({ timeout: 10000 });
  await settingsBtn.click();
  
  // Wait for settings page to be visible
  const settingsPage = page.getByTestId('settings-page');
  await expect(settingsPage).toBeVisible({ timeout: 15000 });
}

/**
 * Force-closes any open dialogs, menus, or overlays by pressing Escape.
 */
export async function closeAllDialogs(page: Page) {
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
}

/**
 * Delete a project through the UI context menu
 */
export async function deleteProjectViaUI(page: Page, name: string) {
  // 1. Close any stray dialogs first
  await closeAllDialogs(page);

  // 2. Open projects panel
  const navProducts = page.getByTestId('nav-products');
  await navProducts.waitFor({ state: 'visible', timeout: 15000 });
  
  // If panel is not visible, click it. If it is visible, don't click (otherwise it might close)
  const isPanelVisible = await page.getByTestId('panel-projects').isVisible().catch(() => false);
  if (!isPanelVisible) {
    await navProducts.click({ force: true });
  }
  
  const projectsPanel = page.getByTestId('panel-projects');
  await expect(projectsPanel).toBeVisible({ timeout: 15000 });

  // 3. Right click the project item to open context menu
  const projectItem = projectsPanel.getByText(name, { exact: true }).first();
  await projectItem.waitFor({ state: 'visible', timeout: 15000 });
  
  // Try right click with retries because context menus can be finicky in CI
  let menuOpened = false;
  for (let i = 0; i < 3; i++) {
    await projectItem.click({ button: 'right', force: true });
    // Check if the menu appeared (looking for "Delete Product")
    const deleteBtnVisible = await page.locator('[role="menuitem"], [role="button"]')
        .filter({ hasText: /Delete Product/i })
        .isVisible().catch(() => false);
    if (deleteBtnVisible) {
        menuOpened = true;
        break;
    }
    await page.waitForTimeout(1000);
  }

  // 4. Click "Delete Product" in context menu
  const deleteBtn = page.locator('[role="menuitem"], [role="button"]')
      .filter({ hasText: /Delete Product/i })
      .first();
  
  await deleteBtn.waitFor({ state: 'visible', timeout: 10000 });
  await deleteBtn.click({ force: true });

  // 5. Confirm in the UI dialog
  const confirmBtn = page.getByRole('button', { name: /Delete|Confirm/i }).first();
  await confirmBtn.waitFor({ state: 'visible', timeout: 10000 });
  await confirmBtn.click({ force: true });

  // Wait for it to be removed
  await expect(projectItem).not.toBeVisible({ timeout: 15000 });
}
