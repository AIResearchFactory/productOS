import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'productos-mm-providers-test-'));
process.env.HOME = path.join(testRoot, 'home');
process.env.APP_DATA_DIR = path.join(testRoot, 'appdata');
process.env.PROJECTS_DIR = path.join(testRoot, 'projects');
process.env.NODE_ENV = 'test';

await fs.mkdir(process.env.HOME, { recursive: true });
await fs.mkdir(process.env.APP_DATA_DIR, { recursive: true });
await fs.mkdir(process.env.PROJECTS_DIR, { recursive: true });

const { HostedAPIProvider } = await import('../lib/providers/hosted.mjs');
const { OllamaProvider } = await import('../lib/providers/ollama.mjs');
const { OpenAiCliProvider } = await import('../lib/providers/openai.mjs');
const { ClaudeCodeProvider } = await import('../lib/providers/claude.mjs');
const { GoogleCliProvider } = await import('../lib/providers/google.mjs');
const { CustomCliProvider } = await import('../lib/providers/custom.mjs');
const { redactModelRequestForCloud } = await import('../lib/model-router.mjs');
const { AgentOrchestrator, sanitizeEventPayloadForLog } = await import('../lib/orchestrator.mjs');
const { AIService } = await import('../lib/ai.mjs');
const { ChatService } = await import('../lib/chat.mjs');
const { getResearchLog } = await import('../lib/research-log.mjs');
const { CostLog } = await import('../lib/cost.mjs');
const SilentLearner = await import('../lib/silent-learner/index.mjs');

const PNG_BYTES = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex');
const PNG_DATA_URL = `data:image/png;base64,${PNG_BYTES.toString('base64')}`;

test.after(async () => {
  await SilentLearner.shutdown().catch(() => {});
  await fs.rm(testRoot, { recursive: true, force: true });
});

async function createEchoCli(dir, filename) {
  const jsFile = path.join(dir, `${filename}.js`);
  await fs.writeFile(
    jsFile,
    `let stdin = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { stdin += c; });
process.stdin.on('end', () => {
  process.stdout.write(JSON.stringify({ args: process.argv.slice(2), stdin }));
});
process.stdin.resume();
`
  );
  const binPath = path.join(dir, process.platform === 'win32' ? `${filename}.cmd` : filename);
  await fs.writeFile(
    binPath,
    process.platform === 'win32'
      ? `@echo off\r\nnode "%~dp0${filename}.js" %*\r\n`
      : `#!/bin/sh\nexec node "$(dirname "$0")/${filename}.js" "$@"\n`
  );
  await fs.chmod(binPath, 0o755);
  return binPath;
}

test('HostedAPIProvider formats image_url blocks for multimodal messages', async () => {
  const origFetch = globalThis.fetch;
  let sentBody = null;
  globalThis.fetch = async (_url, init) => {
    sentBody = JSON.parse(init.body);
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Looks like a roadmap.' } }], usage: {} }),
    };
  };

  try {
    const provider = new HostedAPIProvider({ api_url: 'http://mock.local', model: 'gpt-4o' });
    assert.equal(provider.usesTempFilesForImages(), false);
    const res = await provider.chat({
      messages: [
        {
          role: 'user',
          content: 'What is on this slide?',
          attachments: [{ name: 'slide.png', mimeType: 'image/png', dataUrl: PNG_DATA_URL }],
        },
      ],
    });
    assert.equal(res.content, 'Looks like a roadmap.');
    assert.deepEqual(sentBody.messages[0].content, [
      { type: 'text', text: 'What is on this slide?' },
      { type: 'image_url', image_url: { url: PNG_DATA_URL } },
    ]);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('OllamaProvider sends base64 images array, maps vision errors, and checks /api/show', async () => {
  const origFetch = globalThis.fetch;
  let chatPayload = null;
  globalThis.fetch = async (url, init) => {
    if (url.endsWith('/api/show')) {
      const body = JSON.parse(init.body);
      if (body.name === 'llava') {
        return { ok: true, json: async () => ({ capabilities: ['completion', 'vision'] }) };
      }
      return { ok: true, json: async () => ({ capabilities: ['completion'] }) };
    }
    chatPayload = JSON.parse(init.body);
    if (chatPayload.model === 'llama3') {
      return { ok: false, status: 400, text: async () => 'model does not support vision' };
    }
    return { ok: true, json: async () => ({ message: { content: 'Vision answer' } }) };
  };

  try {
    const visionProvider = new OllamaProvider({ api_url: 'http://ollama.local', model: 'llava' });
    assert.equal(visionProvider.usesTempFilesForImages(), false);
    assert.equal(await visionProvider.checkVisionSupport('llava'), true);
    assert.equal(await visionProvider.checkVisionSupport('llama3'), false);

    const res = await visionProvider.chat({
      messages: [
        {
          role: 'user',
          content: 'Describe',
          attachments: [{ name: 'slide.png', base64: PNG_BYTES.toString('base64'), dataUrl: PNG_DATA_URL }],
        },
      ],
    });
    assert.equal(res.content, 'Vision answer');
    assert.deepEqual(chatPayload.messages[0].images, [PNG_BYTES.toString('base64')]);

    const textOnlyProvider = new OllamaProvider({ api_url: 'http://ollama.local', model: 'llama3' });
    await assert.rejects(
      () =>
        textOnlyProvider.chat({
          messages: [{ role: 'user', content: 'Describe', attachments: [{ base64: PNG_BYTES.toString('base64') }] }],
        }),
      /does not support image analysis/
    );
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('CLI providers inject temp image paths and flags properly', async (t) => {
  const binDir = await fs.mkdtemp(path.join(os.tmpdir(), 'productos-cli-mm-'));
  t.after(async () => {
    await fs.rm(binDir, { recursive: true, force: true });
  });

  const externalImgDir = path.join(binDir, 'ext-imgs');
  await fs.mkdir(externalImgDir, { recursive: true });
  const imgPath = path.join(externalImgDir, '01_slide.png');
  await fs.writeFile(imgPath, PNG_BYTES);
  const projectDir = path.join(binDir, 'proj');
  await fs.mkdir(projectDir, { recursive: true });

  const msgWithImg = [
    {
      role: 'user',
      content: 'Analyze slide',
      tempImagePaths: [{ name: 'slide.png', filePath: imgPath }],
    },
  ];

  // 1. OpenAI Codex passes --image
  const codexBin = await createEchoCli(binDir, 'fake-codex');
  const codexProvider = new OpenAiCliProvider({ command: codexBin, modelAlias: 'gpt-4.1-mini' }, {}, projectDir);
  const codexOut = JSON.parse((await codexProvider.chat({ messages: msgWithImg })).content);
  assert.ok(codexOut.args.includes('--image'));
  assert.ok(codexOut.args.includes(imgPath));
  assert.match(codexOut.stdin, /Attached Temporary Images/);

  // 2. Claude passes --add-dir for external temp dir
  const claudeBin = await createEchoCli(binDir, 'fake-claude');
  const claudeProvider = new ClaudeCodeProvider({ command: claudeBin, model: 'sonnet' }, {}, projectDir);
  const claudeOut = JSON.parse((await claudeProvider.chat({ messages: msgWithImg })).content);
  const addDirIdx = claudeOut.args.indexOf('--add-dir');
  assert.notEqual(addDirIdx, -1);
  assert.equal(claudeOut.args[addDirIdx + 1], externalImgDir);
  assert.match(claudeOut.stdin, /01_slide\.png/);

  // 3. Google agy passes --add-dir while legacy gemini skips --add-dir
  const agyBin = await createEchoCli(binDir, 'fake-agy');
  const agyProvider = new GoogleCliProvider({ command: agyBin }, {}, projectDir);
  const agyOut = JSON.parse((await agyProvider.chat({ messages: msgWithImg })).content);
  assert.ok(agyOut.args.includes('--add-dir'));

  const geminiBin = await createEchoCli(binDir, 'fake-gemini');
  const geminiProvider = new GoogleCliProvider({ command: geminiBin }, {}, projectDir);
  const geminiOut = JSON.parse((await geminiProvider.chat({ messages: msgWithImg })).content);
  assert.equal(geminiOut.args.includes('--add-dir'), false);
  assert.match(geminiOut.stdin, /01_slide\.png/);

  // 4. Custom CLI replaces {{images}} and includes temp paths in prompt
  const customBin = await createEchoCli(binDir, 'fake-custom');
  const customProvider = new CustomCliProvider(
    { id: 'c1', name: 'MyVisionCLI', command: customBin, args: ['--img', '{{images}}'] },
    {},
    projectDir
  );
  const customOut = JSON.parse((await customProvider.chat({ messages: msgWithImg })).content);
  assert.deepEqual(customOut.args, ['--img', imgPath]);
  assert.match(customOut.stdin, /01_slide\.png/);
});

test('redactModelRequestForCloud rejects unapproved images and preserves approved attachments while redacting secrets', () => {
  const requestWithImage = {
    messages: [
      {
        role: 'user',
        content: 'Check this screenshot with api_key=sk-secret123',
        attachments: [{ name: 'slide.png', dataUrl: PNG_DATA_URL }],
      },
    ],
  };

  assert.throws(
    () => redactModelRequestForCloud(requestWithImage),
    (err) => err.code === 'CLOUD_REDACTED_IMAGE_APPROVAL_REQUIRED'
  );

  const redacted = redactModelRequestForCloud(requestWithImage, { allowUnredactedImages: true });
  assert.doesNotMatch(redacted.messages[0].content, /sk-secret123/);
  assert.equal(redacted.messages[0].attachments.length, 1);
  assert.equal(redacted.messages[0].attachments[0].dataUrl, PNG_DATA_URL);
});

test('AgentOrchestrator sanitizes chat history, research log, cost log, Silent Learner, and SSE logs', async () => {
  const projectId = 'mm-sanitization-proj';
  const projPath = path.join(process.env.PROJECTS_DIR, projectId);
  await fs.mkdir(path.join(projPath, '.metadata'), { recursive: true });
  await fs.writeFile(
    path.join(projPath, '.metadata', 'project.json'),
    JSON.stringify({ id: projectId, name: 'Sanitization Test' })
  );

  // Enable Silent Learner observing mode to confirm base64 does NOT trigger secret pause
  await SilentLearner.enable(projectId);

  // Use a realistic-length pseudo-PNG payload (>1KB) so token inflation or secret regexes would be obvious if unsanitized
  const largeBase64Chunk = PNG_BYTES.toString('base64');
  const origCreateProvider = AIService.createProvider;
  AIService.createProvider = async () => ({
    providerType: () => 'hostedApi',
    displayName: async () => 'Hosted API',
    checkAuthentication: async () => true,
    usesTempFilesForImages: () => false,
    resolveModel: async () => 'gpt-4o',
    chat: async () => ({ content: 'Here is the analysis of slide-1.png.', metadata: {} }),
  });

  try {
    const orchestrator = new AgentOrchestrator();
    const res = await orchestrator.runAgentLoop({
      projectId,
      providerType: 'hostedApi',
      messages: [
        {
          role: 'user',
          content: '',
          attachments: [
            {
              name: 'slide-1.png',
              mimeType: 'image/png',
              dataUrl: `data:image/png;base64,${largeBase64Chunk}`,
            },
          ],
        },
      ],
    });

    assert.equal(res.content, 'Here is the analysis of slide-1.png.');

    // Chat file has indicator and zero base64
    const chatFiles = await ChatService.getChatFiles(projectId);
    assert.equal(chatFiles.length, 1);
    const chatMarkdown = await fs.readFile(path.join(projPath, 'chats', chatFiles[0]), 'utf8');
    assert.match(chatMarkdown, /\[1 attachment: slide-1\.png\]/);
    assert.match(chatMarkdown, /Please analyze the attached image\(s\)\./);
    assert.equal(chatMarkdown.includes('data:image'), false);
    assert.equal(chatMarkdown.includes(largeBase64Chunk), false);

    // Research Log has **Attachments** line and zero base64
    const researchEntries = await getResearchLog(projectId);
    assert.equal(researchEntries.length, 1);
    assert.equal(researchEntries[0].attachmentSummary, '1 attachment: slide-1.png');
    assert.deepEqual(researchEntries[0].attachments, ['slide-1.png']);

    // CostLog has reasonable token count (not inflated)
    const costLog = await CostLog.load(path.join(projPath, '.metadata', 'cost_log.json'));
    assert.equal(costLog.records.length, 1);
    assert.ok(costLog.records[0].input_tokens < 2000);

    // Silent Learner remains observing (not paused by false-positive secret match)
    assert.equal(await SilentLearner.getState(projectId), 'observing');

    // sanitizeEventPayloadForLog strips binary keys
    const safePayload = sanitizeEventPayloadForLog('custom', {
      projectId,
      attachments: [{ dataUrl: PNG_DATA_URL }],
      images: [largeBase64Chunk],
      dataUrl: PNG_DATA_URL,
      audioBase64: 'AAA',
    });
    assert.equal('attachments' in safePayload, false);
    assert.equal('images' in safePayload, false);
    assert.equal('dataUrl' in safePayload, false);
    assert.equal('audioBase64' in safePayload, false);
  } finally {
    AIService.createProvider = origCreateProvider;
  }
});
