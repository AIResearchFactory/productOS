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
 */
export async function skipSetupAndReach(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('productOS_mock_onboarding', 'false');
    localStorage.setItem('productOS_runtime_initialized', 'true');
    localStorage.setItem('productOS_animations_disabled', 'true');
  });

  await page.goto('/');
  await disableAnimations(page);

  await expect(page.getByTestId('workspace-layout')).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId('sidebar-navigation')).toBeVisible({ timeout: 30000 });

  const navProjects = page.getByTestId('nav-products');
  await expect(navProjects).toBeVisible({ timeout: 120000 });
}

/**
 * Ensures the chat panel is visible. If it's hidden (e.g. by a document), 
 * it clicks the "Show Chat" button.
 */
export async function ensureChatVisible(page: Page) {
  await page.waitForTimeout(2000);
  const chatInput = page.getByTestId('chat-input');
  
  let isVisible = await chatInput.isVisible().catch(() => false);
  console.log(`[Helpers] Chat input isVisible: ${isVisible}`);
  
  if (!isVisible) {
    console.log('[Helpers] Chat input not visible, looking for "Show Chat" button...');
    const showChatBtn = page.getByTestId('show-chat-button')
      .or(page.getByRole('button', { name: /show chat/i }))
      .first();
    
    try {
      await showChatBtn.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      if (await showChatBtn.isVisible()) {
        console.log('[Helpers] Clicking "Show Chat" button...');
        await showChatBtn.click({ force: true });
        await page.waitForTimeout(1500);
      } else {
        console.log('[Helpers] "Show Chat" button not visible even after wait.');
      }
    } catch (e) {
      console.log(`[Helpers] Failed to show chat panel: ${e}`);
    }
  }

  await expect(chatInput).toBeVisible({ timeout: 20000 });
}

/** 
 * Create a project through the UI
 */
export async function createProjectViaUI(page: Page, name: string, goal: string) {
  console.log(`[E2E] Creating project: ${name}`);
  
  // Ensure we are on projects tab and flyout is open
  const navProducts = page.getByTestId('nav-products');
  await navProducts.waitFor({ state: 'visible', timeout: 15000 });
  
  const projectsPanel = page.getByTestId('panel-projects');
  const isPanelVisible = await projectsPanel.isVisible().catch(() => false);
  if (!isPanelVisible) {
    console.log('[E2E] Opening projects panel...');
    await navProducts.click({ force: true });
  }
  await expect(projectsPanel).toBeVisible({ timeout: 15000 });

  const createBtn = page.getByTestId('btn-create-new-project');
  await expect(createBtn).toBeVisible({ timeout: 15000 });
  console.log('[E2E] Clicking New Project button...');
  await createBtn.click({ force: true });
  
  // Wait for the UI state to change
  await page.waitForTimeout(2000);

  console.log('[E2E] Waiting for project settings view...');
  const settingsContainer = page.getByTestId('view-project-settings');
  await settingsContainer.waitFor({ state: 'visible', timeout: 35000 });
  
  const nameInput = page.getByTestId('project-name-input');
  const goalInput = page.getByTestId('project-goal-input');
  const saveBtn = page.getByTestId('save-project-settings');

  console.log('[E2E] Filling project details...');
  await nameInput.waitFor({ state: 'visible', timeout: 15000 });
  await nameInput.fill(name, { force: true });
  
  await goalInput.waitFor({ state: 'visible', timeout: 15000 });
  await goalInput.fill(goal, { force: true });

  console.log('[E2E] Clicking Save Project button...');
  await saveBtn.click({ force: true });

  // Wait for the project to appear in the sidebar
  console.log('[E2E] Verifying project appearance in sidebar...');
  const projectItem = projectsPanel.getByText(name, { exact: true }).first();
  await expect(projectItem).toBeVisible({ timeout: 60000 });
  console.log(`[E2E] Project ${name} created and verified.`);
}

/**
 * Navigate to the Global Settings page
 */
export async function navigateToSettings(page: Page) {
  const settingsBtn = page.getByTestId('nav-settings');
  await expect(settingsBtn).toBeVisible({ timeout: 15000 });
  await settingsBtn.click();
  
  const settingsPage = page.getByTestId('settings-page');
  await expect(settingsPage).toBeVisible({ timeout: 25000 });
}

/**
 * Force-closes any open dialogs
 */
export async function closeAllDialogs(page: Page) {
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
}

/**
 * Delete a project through the UI context menu
 */
export async function deleteProjectViaUI(page: Page, name: string) {
  console.log(`[E2E] Attempting to delete project: ${name}`);
  await closeAllDialogs(page);

  // ENSURE WE ARE ON THE PROJECTS TAB
  const navProducts = page.getByTestId('nav-products');
  await navProducts.waitFor({ state: 'visible', timeout: 15000 });
  
  const projectsPanel = page.getByTestId('panel-projects');
  const isPanelVisible = await projectsPanel.isVisible().catch(() => false);
  if (!isPanelVisible) {
    console.log('[E2E] Switching to projects tab for deletion...');
    await navProducts.click({ force: true });
  }
  await expect(projectsPanel).toBeVisible({ timeout: 20000 });

  const projectItem = projectsPanel.getByText(name, { exact: true }).first();
  await projectItem.waitFor({ state: 'visible', timeout: 25000 });
  
  let menuOpened = false;
  for (let i = 0; i < 3; i++) {
    console.log(`[E2E] Right-clicking project item (attempt ${i + 1})...`);
    await projectItem.click({ button: 'right', force: true });
    
    const deleteBtn = page.getByTestId('btn-delete-project')
        .or(page.locator('[role="menuitem"], [role="button"]').filter({ hasText: /Delete Product/i }))
        .first();
        
    const deleteBtnVisible = await deleteBtn.isVisible().catch(() => false);
    if (deleteBtnVisible) {
        menuOpened = true;
        await deleteBtn.click({ force: true });
        console.log('[E2E] Clicked "Delete Product" in context menu.');
        break;
    }
    await page.waitForTimeout(2500);
  }

  if (!menuOpened) {
    throw new Error(`Failed to open context menu or click delete for project: ${name}`);
  }

  console.log('[E2E] Waiting for confirmation dialog...');
  const confirmDialog = page.getByRole('dialog').filter({ hasText: /Delete project/i }).first();
  await expect(confirmDialog).toBeVisible({ timeout: 20000 });
  
  const confirmBtn = confirmDialog.getByTestId('confirm-dialog-button')
      .or(confirmDialog.getByRole('button', { name: /Delete|Confirm/i }))
      .first();
      
  await confirmBtn.waitFor({ state: 'visible', timeout: 20000 });
  
  for (let i = 0; i < 4; i++) {
    console.log(`[E2E] Clicking Confirm button (attempt ${i + 1})...`);
    await confirmBtn.click({ force: true });
    await page.waitForTimeout(3000);
    const stillVisible = await projectItem.isVisible().catch(() => false);
    if (!stillVisible) {
        console.log(`[E2E] Project ${name} removed from view.`);
        break;
    }
  }

  await expect(projectItem).not.toBeVisible({ timeout: 30000 });
  console.log(`[E2E] Project ${name} deleted successfully.`);
}
