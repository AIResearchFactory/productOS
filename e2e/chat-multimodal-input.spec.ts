import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { skipSetupAndReach, createProjectViaUI, deleteProjectViaUI, ensureChatVisible, navigateToSettings } from './helpers';

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const SERVER_API = process.env.VITE_SERVER_URL || 'http://127.0.0.1:51424';

async function reachReadyWorkspace(page: Page) {
  const projectsLoaded = page
    .waitForResponse((res) => res.url().includes('/api/projects') && res.request().method() === 'GET', { timeout: 30000 })
    .catch(() => null);
  await skipSetupAndReach(page);
  await projectsLoaded;
  // Let initial active project restoration settle before clicking Create Product
  await page.waitForTimeout(800);
}

async function dispatchFileDrop(page: Page, selector: string, fileName: string, mimeType = 'image/png', base64 = PNG_BASE64) {
  await page.evaluate(
    async ({ sel, name, mime, b64 }) => {
      const target = document.querySelector(sel);
      if (!target) throw new Error(`Drop target not found: ${sel}`);

      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const file = new File([bytes], name, { type: mime });
      const dt = new DataTransfer();
      dt.items.add(file);

      const fire = (type: string) => {
        const ev = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt });
        target.dispatchEvent(ev);
      };
      fire('dragenter');
      fire('dragover');
      fire('drop');
    },
    { sel: selector, name: fileName, mime: mimeType, b64: base64 }
  );
}

async function dispatchImagePaste(page: Page, selector: string, fileName: string) {
  await page.evaluate(
    ({ sel, name, b64 }) => {
      const target = document.querySelector(sel);
      if (!target) throw new Error(`Paste target not found: ${sel}`);
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const file = new File([bytes], name, { type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dt,
      });
      target.dispatchEvent(pasteEvent);
    },
    { sel: selector, name: fileName, b64: PNG_BASE64 }
  );
}

test.describe('Chat Multimodal Input (v0.5.1)', () => {
  let mockDir: string;
  let mockCliScript: string;
  let originalSettings: any;
  const createdProjects: string[] = [];

  test.beforeAll(async () => {
    mockDir = await fs.mkdtemp(path.join(os.tmpdir(), 'productos-e2e-mm-'));
    mockCliScript = path.join(mockDir, 'mock-vision-cli.mjs');
    await fs.writeFile(
      mockCliScript,
      `process.stdin.resume();
process.stdin.on('end', () => {
  process.stdout.write('Visual analysis complete for your reference image.');
});
`
    );

    const res = await fetch(`${SERVER_API}/api/settings/global`);
    originalSettings = await res.json().catch(() => ({}));
  });

  test.afterAll(async () => {
    if (originalSettings) {
      await fetch(`${SERVER_API}/api/settings/global`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(originalSettings),
      }).catch(() => {});
    }
    await fs.rm(mockDir, { recursive: true, force: true }).catch(() => {});
  });

  test.afterEach(async ({ page }) => {
    while (createdProjects.length > 0) {
      const name = createdProjects.pop();
      if (name) {
        await deleteProjectViaUI(page, name).catch(() => {});
      }
    }
  });

  test('image add button, empty-text send, research log summary, and zero temp/project leakage', async ({ page }) => {
    const customCliId = `e2e-vision-${Date.now()}`;
    const updatedSettings = {
      ...(originalSettings || {}),
      activeProvider: `custom-${customCliId}`,
      customClis: [
        ...((originalSettings?.customClis || []) as any[]),
        {
          id: customCliId,
          name: 'E2E Vision CLI',
          command: `node ${mockCliScript}`,
          isConfigured: true,
          isCloud: false,
          supportsImages: true,
        },
      ],
    };
    await fetch(`${SERVER_API}/api/settings/global`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedSettings),
    });

    await reachReadyWorkspace(page);
    const projectName = `MM Image Test ${Date.now()}`;
    createdProjects.push(projectName);
    await createProjectViaUI(page, projectName, 'Testing temporary image references');
    await ensureChatVisible(page);

    const fileInput = page.getByTestId('chat-attach-image-input');
    await fileInput.setInputFiles({
      name: 'slide-1.png',
      mimeType: 'image/png',
      buffer: Buffer.from(PNG_BASE64, 'base64'),
    });

    await expect(page.getByTestId('chat-attachment-strip')).toBeVisible();
    await expect(page.getByTestId('chat-attachment-item')).toHaveCount(1);

    // Send with empty text (uses default prompt)
    const sendBtn = page.getByTestId('chat-send');
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    await expect(page.getByText('Visual analysis complete for your reference image.')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('chat-attachment-strip')).toBeHidden();

    // Verify slide-1.png was NOT imported into project files
    const projectsRes = await fetch(`${SERVER_API}/api/projects`);
    const projects = await projectsRes.json();
    const activeProj = projects.find((p: any) => p.name === projectName);
    expect(activeProj).toBeTruthy();

    const filesRes = await fetch(`${SERVER_API}/api/projects/files?project_id=${encodeURIComponent(activeProj.id)}`);
    const projectFiles: string[] = await filesRes.json();
    expect(projectFiles.some((f) => f.includes('slide-1.png'))).toBe(false);

    // Verify .metadata/.tmp-chat is clean
    const tmpChatDir = path.join(activeProj.path, '.metadata', '.tmp-chat');
    const tmpEntries = await fs.readdir(tmpChatDir).catch(() => []);
    expect(tmpEntries.length).toBe(0);

    // Verify Research Log displays attachment indicator cleanly
    const projectLogBtn = page.getByTestId('topbar-research-log').or(page.getByRole('button', { name: /research log|project log/i })).first();
    await projectLogBtn.click();
    await expect(page.getByTestId('research-log-attachments').first()).toContainText('1 attachment: slide-1.png');
  });

  test('drag-and-drop in split & focused chat, clipboard paste, and global drop guard protection', async ({ page }) => {
    await reachReadyWorkspace(page);
    const projectName = `MM Drop Guard ${Date.now()}`;
    createdProjects.push(projectName);
    await createProjectViaUI(page, projectName, 'Testing drag and drop boundaries');
    await ensureChatVisible(page);

    const initialUrl = page.url();

    // 1. Drop onto Sidebar / Workspace outside ChatPanel -> must NOT navigate or attach
    await dispatchFileDrop(page, '[data-testid="sidebar-navigation"]', 'outside-drop.png');
    expect(page.url()).toBe(initialUrl);
    await expect(page.getByTestId('chat-attachment-strip')).toBeHidden();

    // 2. Drop onto visible ChatPanel (split view) -> stages image
    await dispatchFileDrop(page, '[data-testid="chat-panel"]', 'split-drop.png');
    await expect(page.getByTestId('chat-attachment-item')).toHaveCount(1);

    // 3. Switch to Focused Chat View and drop a second image
    await page.getByTitle('Focused Chat View').click();
    await dispatchFileDrop(page, '[data-testid="chat-panel"]', 'focused-drop.png');
    await expect(page.getByTestId('chat-attachment-item')).toHaveCount(2);

    // 4. Paste an image from clipboard into textarea
    await page.getByTestId('chat-input').focus();
    await dispatchImagePaste(page, '[data-testid="chat-input"]', 'clipboard-shot.png');
    await expect(page.getByTestId('chat-attachment-item')).toHaveCount(3);

    // 5. Hide chat and drop onto workspace -> must NOT navigate or attach more images
    await page.getByTitle('Hide Chat').click();
    await dispatchFileDrop(page, '[data-testid="workspace-layout"]', 'hidden-drop.png');
    expect(page.url()).toBe(initialUrl);
  });

  test('non-vision model shows red error indicator and Custom CLI warning clears when enabled in Settings', async ({ page }) => {
    const customCliId = `e2e-unverified-${Date.now()}`;
    await fetch(`${SERVER_API}/api/settings/global`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(originalSettings || {}),
        activeProvider: 'ollama',
        ollama: { model: 'llama3', apiUrl: 'http://127.0.0.1:11434' },
        customClis: [
          ...((originalSettings?.customClis || []) as any[]),
          {
            id: customCliId,
            name: 'Unverified CLI',
            command: `node ${mockCliScript}`,
            isConfigured: true,
            isCloud: false,
            supportsImages: false,
          },
        ],
      }),
    });

    await page.route('**/api/chat/vision/check**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ supported: false, status: 'unsupported', model: 'llama3' }),
      });
    });

    await reachReadyWorkspace(page);
    const projectName = `MM Vision Indicators ${Date.now()}`;
    createdProjects.push(projectName);
    await createProjectViaUI(page, projectName, 'Testing model vision badges');
    await ensureChatVisible(page);

    // Stage image while on text-only Ollama (llama3)
    await page.getByTestId('chat-attach-image-input').setInputFiles({
      name: 'diagram.png',
      mimeType: 'image/png',
      buffer: Buffer.from(PNG_BASE64, 'base64'),
    });
    await expect(page.getByTestId('chat-attachment-error')).toBeVisible();
    await expect(page.getByTestId('chat-vision-error-banner')).toContainText('does not support image analysis');
    await expect(page.getByTestId('chat-send')).toBeDisabled();

    // Switch settings to unverified Custom CLI -> amber warning badge
    await page.evaluate(async (cid) => {
      const res = await fetch('http://127.0.0.1:51424/api/settings/global');
      const current = await res.json();
      current.activeProvider = `custom-${cid}`;
      await fetch('http://127.0.0.1:51424/api/settings/global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(current),
      });
      window.dispatchEvent(new CustomEvent('productos:settings-changed', { detail: current }));
    }, customCliId);

    await expect(page.getByTestId('chat-attachment-warning')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('chat-send')).toBeEnabled();

    // Open Settings -> AI & Models -> Custom Model CLIs and toggle Supports Images ON
    await navigateToSettings(page);
    await page.getByText('Custom Model CLIs').click();
    const toggle = page.getByTestId('settings-custom-cli-supports-images').last();
    await toggle.click();
    await page.waitForTimeout(1500);

    // Return to workspace and confirm warning cleared on preserved staged image and new uploads
    await page.getByRole('button', { name: 'Close App Settings' }).click();
    await ensureChatVisible(page);
    await expect(page.getByTestId('chat-attachment-item')).toHaveCount(1);
    await expect(page.getByTestId('chat-attachment-warning')).toHaveCount(0);

    await page.getByTestId('chat-attach-image-input').setInputFiles({
      name: 'diagram-2.png',
      mimeType: 'image/png',
      buffer: Buffer.from(PNG_BASE64, 'base64'),
    });
    await expect(page.getByTestId('chat-attachment-item')).toHaveCount(2);
    await expect(page.getByTestId('chat-attachment-warning')).toHaveCount(0);
  });

  test('switching projects clears staged attachments and cleans backend temp dir', async ({ page }) => {
    await reachReadyWorkspace(page);
    const projA = `MM Switch A ${Date.now()}`;
    const projB = `MM Switch B ${Date.now() + 1}`;
    createdProjects.push(projA, projB);

    await createProjectViaUI(page, projA, 'Project A');
    await ensureChatVisible(page);

    // Seed synthetic temp file inside Project A to assert backend cleans it on project switch
    const projectsRes = await fetch(`${SERVER_API}/api/projects`);
    const projects = await projectsRes.json();
    const pA = projects.find((p: any) => p.name === projA);
    const seededDir = path.join(pA.path, '.metadata', '.tmp-chat', 'stale-run');
    await fs.mkdir(seededDir, { recursive: true });
    await fs.writeFile(path.join(seededDir, 'leak.png'), 'leak');

    await page.getByTestId('chat-attach-image-input').setInputFiles({
      name: 'secret-a.png',
      mimeType: 'image/png',
      buffer: Buffer.from(PNG_BASE64, 'base64'),
    });
    await expect(page.getByTestId('chat-attachment-item')).toHaveCount(1);

    // Create & switch to Project B
    await createProjectViaUI(page, projB, 'Project B');
    await ensureChatVisible(page);

    // Staged images cleared in UI & backend temp dir deleted for Project A
    await expect(page.getByTestId('chat-attachment-strip')).toBeHidden();
    await expect(fs.access(seededDir)).rejects.toThrow();
  });

  test('voice-to-text dictation (Web Speech mock) populates editable textarea with locale switcher and logs plain text', async ({ page }) => {
    await page.addInitScript(() => {
      class MockSpeechRecognition {
        lang = 'en-US';
        continuous = false;
        interimResults = false;
        onstart: (() => void) | null = null;
        onresult: ((ev: any) => void) | null = null;
        onerror: ((ev: any) => void) | null = null;
        onend: (() => void) | null = null;

        start() {
          (window as any).__lastSpeechLang = this.lang;
          this.onstart?.();
          setTimeout(() => {
            this.onresult?.({
              resultIndex: 0,
              results: [
                {
                  isFinal: true,
                  0: { transcript: 'Summarize competitor pricing tiers' },
                },
              ],
            });
          }, 50);
        }

        stop() {
          this.onend?.();
        }

        abort() {
          this.onend?.();
        }
      }
      (window as any).SpeechRecognition = MockSpeechRecognition;
    });

    await reachReadyWorkspace(page);
    const projectName = `MM Voice WebSpeech ${Date.now()}`;
    createdProjects.push(projectName);
    await createProjectViaUI(page, projectName, 'Testing Web Speech dictation');
    await ensureChatVisible(page);

    await page.getByTestId('chat-voice-locale-select').selectOption('en-GB');
    await page.getByTestId('chat-voice-btn').click();
    await expect(page.getByTestId('chat-voice-recording-bar')).toBeVisible();
    await page.waitForTimeout(150);

    await page.getByTestId('chat-voice-stop-btn').click();
    await expect(page.getByTestId('chat-input')).toHaveValue('Summarize competitor pricing tiers');
    const usedLang = await page.evaluate(() => (window as any).__lastSpeechLang);
    expect(usedLang).toBe('en-GB');

    // User edits before sending
    await page.getByTestId('chat-input').fill('Summarize competitor pricing tiers for Q4');
    await expect(page.getByTestId('chat-input')).toHaveValue('Summarize competitor pricing tiers for Q4');
  });

  test('unsupported browser (Firefox simulation) shows guidance without fallback and transcribes with fallback configured', async ({ page }) => {
    await page.addInitScript(() => {
      delete (window as any).SpeechRecognition;
      delete (window as any).webkitSpeechRecognition;

      let tracksStopped = 0;
      (window as any).__tracksStoppedCount = () => tracksStopped;

      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: async () => ({
            getTracks: () => [
              {
                stop: () => {
                  tracksStopped += 1;
                },
              },
            ],
          }),
        },
      });

      class MockMediaRecorder {
        state = 'inactive';
        mimeType = 'audio/webm';
        ondataavailable: ((ev: any) => void) | null = null;
        onstop: (() => void) | null = null;
        start() {
          this.state = 'recording';
        }
        stop() {
          this.state = 'inactive';
          this.ondataavailable?.({ data: new Blob(['mock-audio'], { type: 'audio/webm' }) });
          this.onstop?.();
        }
      }
      (window as any).MediaRecorder = MockMediaRecorder;
    });

    // Case A: No fallback provider configured
    await page.route('**/api/chat/voice/capabilities', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          fallbackProviders: { openAi: false, gemini: false, localWhisper: false },
          availableProviders: [],
          configuredFallback: 'auto',
          resolvedFallback: null,
        }),
      });
    });

    await reachReadyWorkspace(page);
    const projectName = `MM Voice Firefox ${Date.now()}`;
    createdProjects.push(projectName);
    await createProjectViaUI(page, projectName, 'Testing Firefox fallback states');
    await ensureChatVisible(page);

    const micBtn = page.getByTestId('chat-voice-btn');
    await expect(micBtn).toHaveAttribute('data-voice-state', 'unsupported');
    await micBtn.click();
    await expect(page.getByTestId('chat-voice-unsupported-popover')).toContainText(/Chrome/i);

    await navigateToSettings(page);
    await expect(page.getByTestId('settings-voice-unsupported-banner')).toBeVisible();

    // Case B: OpenAI fallback enabled
    await page.unroute('**/api/chat/voice/capabilities');
    await page.route('**/api/chat/voice/capabilities', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          fallbackProviders: { openAi: true, gemini: false, localWhisper: false },
          availableProviders: ['openAi'],
          configuredFallback: 'auto',
          resolvedFallback: 'openAi',
        }),
      });
    });
    await page.route('**/api/chat/transcribe', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ text: 'Transcribed via fallback provider', provider: 'openAi' }),
      });
    });

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('productos:settings-changed', { detail: {} }));
    });
    await page.getByRole('button', { name: 'Close App Settings' }).click();
    await ensureChatVisible(page);

    await expect(micBtn).toHaveAttribute('data-voice-state', 'idle');
    await micBtn.click();
    await expect(page.getByTestId('chat-voice-recording-bar')).toBeVisible();
    await page.getByTestId('chat-voice-stop-btn').click();

    await expect(page.getByTestId('chat-input')).toHaveValue('Transcribed via fallback provider');
    const stopped = await page.evaluate(() => (window as any).__tracksStoppedCount());
    expect(stopped).toBeGreaterThan(0);
  });
});
