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
export async function createProjectViaUI(page: Page, name: string, goal: string = 'E2E Test Goal') {
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
  
  // Robust click and wait for settings view
  console.log('[E2E] Clicking New Project button...');
  const settingsContainer = page.getByTestId('view-project-settings');
  
  let settingsVisible = false;
  for (let i = 0; i < 3; i++) {
    await createBtn.click({ force: true });
    try {
      await settingsContainer.waitFor({ state: 'visible', timeout: 5000 });
      settingsVisible = true;
      break;
    } catch (e) {
      console.log(`[E2E] Settings view not visible after click (attempt ${i + 1}), retrying...`);
    }
  }

  if (!settingsVisible) {
    console.log('[E2E] Final wait for project settings view...');
    await settingsContainer.waitFor({ state: 'visible', timeout: 25000 });
  }

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
  console.log(`[E2E] Verifying project appearance in sidebar for ${name}...`);
  const projectItem = page.getByTestId(`project-item-${name}`).first();
  await projectItem.scrollIntoViewIfNeeded();
  await projectItem.waitFor({ state: 'visible', timeout: 45000 });
  await expect(projectItem).toBeVisible({ timeout: 15000 });
  
  // Click to select it and make it active
  await projectItem.click({ force: true });
  console.log(`[E2E] Project ${name} created and selected.`);
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

  const projectItem = projectsPanel.getByTestId(`project-item-${name}`).first();
  await projectItem.scrollIntoViewIfNeeded();
  await projectItem.waitFor({ state: 'visible', timeout: 25000 });
  
  let menuOpened = false;
  for (let i = 0; i < 4; i++) {
    console.log(`[E2E] Right-clicking project item (attempt ${i + 1})...`);
    await projectItem.click({ button: 'right', force: true });
    
    // Small wait for context menu to be stable
    await page.waitForTimeout(1000);
    
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
    await page.waitForTimeout(2000);
  }

  if (!menuOpened) {
    throw new Error(`Failed to open context menu or click delete for project: ${name}`);
  }

  console.log('[E2E] Waiting for confirmation dialog...');
  const confirmDialog = page.getByTestId('confirmation-dialog')
      .or(page.getByRole('dialog').filter({ hasText: /Delete|Remove/i }))
      .first();
      
  await expect(confirmDialog).toBeVisible({ timeout: 25000 });
  
  // If it's a type-to-confirm dialog, fill the input
  const confirmInput = confirmDialog.locator('input');
  if (await confirmInput.isVisible().catch(() => false)) {
    console.log(`[E2E] Filling confirmation input with: ${name}`);
    await confirmInput.fill(name);
  }

  const confirmBtn = confirmDialog.getByTestId('confirm-dialog-button')
      .or(confirmDialog.getByRole('button', { name: /Delete|Confirm/i }))
      .first();
      
  await expect(confirmBtn).toBeEnabled({ timeout: 10000 });
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

/**
 * Open workflows panel if not already open
 */
export async function openWorkflowsPanel(page: Page) {
  const navWorkflows = page.getByTestId('nav-workflows');
  await navWorkflows.waitFor({ state: 'visible' });
  
  const isPanelVisible = await page.getByTestId('panel-workflows').isVisible().catch(() => false);
  if (!isPanelVisible) {
    await navWorkflows.click({ force: true });
  }
  
  await expect(page.getByTestId('panel-workflows')).toBeVisible({ timeout: 15000 });
}

/**
 * Create a workflow through the multi-step builder
 */
export async function createWorkflowViaBuilder(page: Page, name: string, description = 'Testing workflows') {
  console.log(`[E2E] Creating workflow: ${name}`);
  await openWorkflowsPanel(page);
  
  await page.getByTestId('workflow-create-button').click();
  const dialog = page.getByRole('dialog').filter({ hasText: /create workflow/i }).last();
  await expect(dialog).toBeVisible({ timeout: 10000 });

  const nameInput = dialog.locator('#wf-name');
  const descInput = dialog.locator('#wf-desc');
  const projectSelect = dialog.locator('#wf-project');

  await nameInput.waitFor({ state: 'visible', timeout: 10000 });
  
  // Robust fill with retry
  for (let i = 0; i < 3; i++) {
    await nameInput.fill(name);
    await descInput.fill(description);
    await page.waitForTimeout(500);
    const currentVal = await nameInput.inputValue();
    if (currentVal === name) break;
    console.log(`[E2E] Name input mismatch (attempt ${i + 1}), retrying...`);
  }
  
  await expect(nameInput).toHaveValue(name);
  await expect(projectSelect).not.toHaveValue('');

  // Step 1 -> 2
  console.log('[E2E] Workflow Step 1 -> 2');
  const nextBtn = dialog.getByRole('button', { name: /next/i });
  await nextBtn.click();
  await page.waitForTimeout(1000);
  
  // Step 2 -> 3
  console.log('[E2E] Workflow Step 2 -> 3');
  await nextBtn.click();
  await page.waitForTimeout(1000);

  // Step 3 -> 4
  console.log('[E2E] Workflow Step 3 -> 4');
  await nextBtn.click();
  await page.waitForTimeout(1000);

  // Step 4: Final Submit
  console.log('[E2E] Workflow Step 4: Final Submit');
  const createButton = dialog.getByRole('button', { name: /create workflow|create and open builder/i });
  await expect(createButton).toBeEnabled({ timeout: 10000 });
  await createButton.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await createButton.click({ force: true });
  await page.waitForTimeout(500);

  await expect(dialog).toBeHidden({ timeout: 10000 });
  
  // Wait for the workflow to appear in the list
  const workflowId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
  await expect(page.getByTestId(`workflow-item-${workflowId}`)).toBeVisible({ timeout: 15000 });
}
