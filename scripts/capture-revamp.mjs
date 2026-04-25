import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const outDir = path.resolve('test-artifacts', 'revamp-shots');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });

await fs.mkdir(outDir, { recursive: true });
console.log('capture:start');

await page.addInitScript(() => {
  const now = new Date().toISOString();
  const projectId = 'proj-revamp-capture';
  const workflowId = 'wf-revamp-capture';

  localStorage.setItem('productOS_mock_onboarding', 'false');
  localStorage.setItem('productOS_runtime_initialized', 'true');
  localStorage.setItem('mock_projects', JSON.stringify([
    {
      id: projectId,
      name: 'Revamp Capture Demo',
      goal: 'Visual verification fixture for workflow screenshots',
      skills: [],
      created_at: now,
    },
  ]));
  localStorage.setItem('mock_settings', JSON.stringify({
    defaultModel: 'local-browser-runtime',
    theme: 'dark',
    notificationsEnabled: true,
    activeProvider: 'ollama',
    ollama: { model: 'llama3.1', apiUrl: 'http://localhost:11434' },
    claude: { model: 'claude-sonnet-4' },
    hosted: { provider: 'openrouter', model: 'openai/gpt-4.1', apiKeySecretId: '' },
    geminiCli: { command: 'gemini', modelAlias: 'gemini-1.5-pro', apiKeySecretId: '' },
    openAiCli: { command: 'codex', modelAlias: 'gpt-5-codex', apiKeySecretId: '' },
    liteLlm: {
      enabled: false,
      baseUrl: '',
      apiKeySecretId: '',
      strategy: { defaultModel: '', researchModel: '', codingModel: '', editingModel: '' },
      shadowMode: false,
    },
    customClis: [],
    mcpServers: [],
    autoEscalateThreshold: 5,
    budgetWarningThreshold: 10,
    selectedProviders: ['ollama'],
    enableAiAutocomplete: false,
    lastProjectId: projectId,
    channelConfig: {
      enabled: false,
      telegramEnabled: false,
      whatsappEnabled: false,
      defaultProjectRouting: '',
      telegramDefaultChatId: '',
      whatsappPhoneNumberId: '',
      whatsappDefaultRecipient: '',
      notes: '',
      hasTelegramToken: false,
      hasWhatsappToken: false,
    },
  }));
  localStorage.setItem('mock_workflows', JSON.stringify([
    {
      id: workflowId,
      project_id: projectId,
      name: 'Competitive Research Loop',
      description: 'Track competitors, summarize changes, and post a digest.',
      steps: [
        { id: 'step-scan', name: 'Scan sources', step_type: 'research', config: { prompt: 'Review target competitor feeds and release notes.' }, depends_on: [] },
        { id: 'step-summarize', name: 'Summarize findings', step_type: 'analysis', config: { prompt: 'Group findings into themes and important deltas.' }, depends_on: ['step-scan'] },
        { id: 'step-publish', name: 'Publish digest', step_type: 'output', config: { destination: 'Slack digest + project artifact' }, depends_on: ['step-summarize'] },
      ],
      version: '1.0.0',
      created: now,
      updated: now,
      status: 'Ready',
      notify_on_completion: true,
      schedule: { enabled: true, cron: '0 9 * * 1', timezone: 'Asia/Jerusalem' },
    },
  ]));
  localStorage.setItem('mock_project_file_contents', JSON.stringify({
    [projectId]: {
      'README.md': '# Revamp Capture Demo',
      'context.md': 'Workflow visual capture fixture',
    },
  }));

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
    if (url.includes('/api/health')) {
      throw new TypeError('Capture script forcing browser-runtime mode');
    }
    return originalFetch(input, init);
  };
});

await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 120000 });
console.log('capture:goto-1');
await page.locator('[data-testid="app-ready"]').waitFor({ state: 'visible', timeout: 120000 });
await page.locator('[data-testid="nav-products"]').waitFor({ state: 'visible', timeout: 60000 });
await page.waitForTimeout(1500);
console.log('capture:app-ready-1');

await page.screenshot({ path: path.join(outDir, '01-overview.png'), fullPage: true });
console.log('capture:shot-1');

await page.getByTestId('nav-products').click();
await page.locator('[data-testid="panel-projects"]').waitFor({ state: 'visible', timeout: 10000 });
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(outDir, '02-sidebar-products.png'), fullPage: true });
console.log('capture:shot-2');

await page.locator('[data-testid="chat-input"]').evaluate((el) => {
  (el instanceof HTMLElement) && el.focus();
});
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(outDir, '03-chat-panel.png'), fullPage: true });
console.log('capture:shot-3');

const settingsNav = page.getByTestId('nav-settings');
if (await settingsNav.count()) {
  await settingsNav.click();
  await page.locator('[data-testid="settings-page"]').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, '04-settings.png'), fullPage: true });
  console.log('capture:shot-4');
}

await page.getByTestId('nav-workflows').click();
await page.locator('[data-testid="panel-workflows"]').waitFor({ state: 'visible', timeout: 15000 });
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(outDir, '05-workflows-list.png'), fullPage: true });
console.log('capture:shot-5');

await page.getByTestId('workflow-item-wf-revamp-capture').click();
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(outDir, '06-workflow-canvas.png') });
console.log('capture:shot-6');

await browser.close();
console.log(outDir);
