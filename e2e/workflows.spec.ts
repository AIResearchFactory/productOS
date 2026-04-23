import { test, expect, type Locator, type Page } from '@playwright/test';
import { skipSetupAndReach, createProjectViaUI } from './helpers';

async function openWorkflowsPanel(page: Page) {
  await page.getByTestId('nav-workflows').click();
  await expect(page.getByTestId('panel-workflows')).toBeVisible({ timeout: 10000 });
}

async function ensureChatVisible(page: Page) {
  const chatInput = page.getByTestId('chat-input');
  if (await chatInput.isVisible().catch(() => false)) return;
  await page.getByRole('button', { name: /show chat/i }).click();
  await expect(chatInput).toBeVisible({ timeout: 10000 });
}

async function openCreateWorkflowDialog(page: Page) {
  await openWorkflowsPanel(page);
  await page.getByTestId('workflow-create-button').click();
  const dialog = page.getByRole('dialog').filter({ hasText: /create workflow/i }).last();
  await expect(dialog).toBeVisible({ timeout: 10000 });
  return dialog;
}

async function createWorkflowViaBuilder(page: Page, name: string, description = 'Testing workflows') {
  const dialog = await openCreateWorkflowDialog(page);
  const nameInput = dialog.locator('#wf-name');
  const descInput = dialog.locator('#wf-desc');
  const projectSelect = dialog.locator('#wf-project');

  await nameInput.fill(name);
  await descInput.fill(description);
  await expect(nameInput).toHaveValue(name);
  await expect(projectSelect).not.toHaveValue('');

  const createButton = dialog.getByRole('button', { name: /create workflow/i });
  await expect(createButton).toBeEnabled({ timeout: 10000 });
  await createButton.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await createButton.click({ force: true });

  await expect(dialog).toBeHidden({ timeout: 10000 });
  await expect(page.getByTestId(`workflow-item-${name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '')}`)).toBeVisible({ timeout: 15000 });
}

async function getWorkflowItem(page: Page, name: string): Promise<Locator> {
  const workflowId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
  const item = page.getByTestId(`workflow-item-${workflowId}`);
  await expect(item).toBeVisible({ timeout: 15000 });
  return item;
}

async function selectWorkflow(page: Page, name: string) {
  const workflowItem = await getWorkflowItem(page, name);
  await workflowItem.click();
}

async function createWorkflowViaMagic(page: Page, prompt: string) {
  const builderDialog = await openCreateWorkflowDialog(page);
  await builderDialog.getByRole('button', { name: /^magic$/i }).click();

  const magicDialog = page.getByRole('dialog').filter({ hasText: /magic workflow builder/i }).last();
  await expect(magicDialog).toBeVisible({ timeout: 10000 });
  await magicDialog.getByRole('textbox').first().fill(prompt);
  await magicDialog.getByRole('button', { name: /generate workflow/i }).click();

  await expect(magicDialog).toBeHidden({ timeout: 120000 });
  await expect(builderDialog.locator('#wf-name')).not.toHaveValue('', { timeout: 30000 });

  const generatedName = await builderDialog.locator('#wf-name').inputValue();
  await builderDialog.getByRole('button', { name: /create workflow/i }).click();
  await expect(builderDialog).toBeHidden({ timeout: 10000 });

  await getWorkflowItem(page, generatedName);
  return generatedName;
}

test.describe('Workflow Engine', () => {
  test.beforeEach(async ({ page }) => {
    await skipSetupAndReach(page);
    const uniqueProjectName = `Workflow Test Project ${Date.now()}`;
    await createProjectViaUI(page, uniqueProjectName, 'Testing workflows');
  });

  test.skip('create workflow from chat approval flow', async ({ page }) => {
    await ensureChatVisible(page);

    const composer = page.getByTestId('chat-input');
    await composer.fill('Create a workflow to summarize competitor notes every day');
    await composer.press('Enter');

    const approveButton = page.getByRole('button', { name: /approve/i }).last();
    await expect(approveButton).toBeVisible({ timeout: 60000 });
    await approveButton.click();

    await expect(page.getByText(/configuration applied/i)).toBeVisible({ timeout: 30000 });
    const executeNow = page.getByRole('button', { name: /execute workflow now/i }).last();
    await expect(executeNow).toBeVisible({ timeout: 30000 });

    await openWorkflowsPanel(page);
    await expect(page.locator('[data-testid^="workflow-item-"]')).toHaveCount(1, { timeout: 15000 });
  });

  test('create workflow using the magic button', async ({ page }) => {
    await createWorkflowViaMagic(page, 'Build a workflow that researches two competitors and writes a short markdown summary');
  });

  test('run workflow and show history entry', async ({ page }) => {
    const workflowName = `Run History Workflow ${Date.now()}`;
    await createWorkflowViaBuilder(page, workflowName);
    await selectWorkflow(page, workflowName);

    await page.getByRole('button', { name: /^run workflow$/i }).click();

    const resultDialog = page.getByRole('dialog').filter({ hasText: /workflow/i }).last();
    await expect(resultDialog).toBeVisible({ timeout: 120000 });
    await expect(resultDialog.getByText(/completed|failed|partial/i).first()).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /history/i }).click();
    await expect(page.getByText(/run history/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/manual/i).first()).toBeVisible({ timeout: 30000 });
  });

  test('shows workflow progress overlay while running', async ({ page }) => {
    const workflowName = `Progress Workflow ${Date.now()}`;
    await createWorkflowViaBuilder(page, workflowName);
    await selectWorkflow(page, workflowName);

    await page.getByRole('button', { name: /^run workflow$/i }).click();
    await expect(page.getByText(/starting workflow|running:/i).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByTitle(/stop workflow execution/i)).toBeVisible({ timeout: 30000 });
  });

  test('can open scheduling dialog and save a schedule', async ({ page }) => {
    const workflowName = `Scheduled Workflow ${Date.now()}`;
    await createWorkflowViaBuilder(page, workflowName);
    await selectWorkflow(page, workflowName);

    await page.getByTestId('panel-workflows').getByRole('button', { name: /^schedule$/i }).click();
    const dialog = page.getByRole('dialog').filter({ hasText: /workflow schedule/i }).last();
    await expect(dialog).toBeVisible({ timeout: 10000 });

    await dialog.getByRole('button', { name: /weekly/i }).click();
    await dialog.getByRole('button', { name: /save schedule/i }).click();

    await expect(dialog.getByText(/saved:/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId(`workflow-item-${workflowName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '')}`)).toContainText(/scheduled/i, { timeout: 15000 });
  });

  test('workflow optimizer dialog opens and closes', async ({ page }) => {
    await openWorkflowsPanel(page);

    const optimizerBtn = page.getByTestId('workflow-optimizer-button');
    await expect(optimizerBtn).toBeVisible({ timeout: 10000 });
    await optimizerBtn.click();

    const dialog = page.getByTestId('workflow-optimizer-dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await expect(dialog).toContainText('Risk:');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 5000 });
  });

  test.fixme('can stop a workflow mid-process', async ({ page }) => {
    const workflowName = `Stop Workflow ${Date.now()}`;
    await createWorkflowViaBuilder(page, workflowName);
    await selectWorkflow(page, workflowName);
    await page.getByRole('button', { name: /^run workflow$/i }).click();
    await expect(page.getByText(/starting workflow|running:/i).first()).toBeVisible({ timeout: 30000 });
    await page.getByTitle(/stop workflow execution/i).click();
    await expect(page.getByText(/failed|stopped|cancelled/i).first()).toBeVisible({ timeout: 30000 });
  });
});
