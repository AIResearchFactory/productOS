import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';

const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'productos-temp-att-test-'));
process.env.HOME = path.join(testRoot, 'home');
process.env.APP_DATA_DIR = path.join(testRoot, 'appdata');
process.env.PROJECTS_DIR = path.join(testRoot, 'projects');
process.env.NODE_ENV = 'test';

await fs.mkdir(process.env.HOME, { recursive: true });
await fs.mkdir(process.env.APP_DATA_DIR, { recursive: true });
await fs.mkdir(process.env.PROJECTS_DIR, { recursive: true });

const {
  MAX_CHAT_ATTACHMENTS,
  MAX_CHAT_IMAGE_BYTES,
  MAX_CHAT_REQUEST_BYTES,
  GLOBAL_TMP_CHAT_DIR,
  detectImageMagicMime,
  sanitizeAttachmentName,
  validateAndDecodeAttachments,
  formatAttachmentsSummary,
  materializeTempAttachments,
  getRegisteredTempDirs,
  cleanupTempDir,
  cleanupProjectTempAttachments,
  cleanupAllTempAttachments,
} = await import('../lib/temp-attachments.mjs');
const { readJson } = await import('../lib/http.mjs');
const { AgentOrchestrator } = await import('../lib/orchestrator.mjs');
const { AIService } = await import('../lib/ai.mjs');

// Minimal valid binary image signatures
const PNG_BYTES = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex');
const JPEG_BYTES = Buffer.from('ffd8ffe000104a46494600010101004800480000ffd9', 'hex');
const GIF_BYTES = Buffer.from('47494638396101000100800000ffffff00000021f90401000000002c00000000010001000002024401003b', 'hex');
const WEBP_BYTES = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x14, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP'),
  Buffer.from('VP8 '),
  Buffer.from([0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
]);

test.after(async () => {
  await cleanupAllTempAttachments();
  await fs.rm(testRoot, { recursive: true, force: true });
});

test('detectImageMagicMime identifies PNG, JPEG, GIF, WebP and rejects plain text', () => {
  assert.equal(detectImageMagicMime(PNG_BYTES), 'image/png');
  assert.equal(detectImageMagicMime(JPEG_BYTES), 'image/jpeg');
  assert.equal(detectImageMagicMime(GIF_BYTES), 'image/gif');
  assert.equal(detectImageMagicMime(WEBP_BYTES), 'image/webp');
  assert.equal(detectImageMagicMime(Buffer.from('not an image')), null);
});

test('sanitizeAttachmentName strips traversal and enforces safe image extension', () => {
  assert.equal(sanitizeAttachmentName('../../etc/passwd?.png', 0, 'image/png'), 'passwd_.png');
  assert.equal(sanitizeAttachmentName('.hidden', 1, 'image/jpeg'), 'hidden.jpg');
  assert.equal(sanitizeAttachmentName('', 2, 'image/webp'), 'image-3.webp');
});

test('validateAndDecodeAttachments validates magic bytes, count, and size caps', () => {
  const valid = validateAndDecodeAttachments([
    { name: 'slide.png', mimeType: 'image/png', dataUrl: `data:image/png;base64,${PNG_BYTES.toString('base64')}` },
    { name: 'photo.jpg', mimeType: 'image/jpg', dataUrl: `data:image/jpg;base64,${JPEG_BYTES.toString('base64')}` },
  ]);
  assert.equal(valid.length, 2);
  assert.equal(valid[0].mimeType, 'image/png');
  assert.equal(valid[1].mimeType, 'image/jpeg');

  // Spoofed PNG
  assert.throws(
    () =>
      validateAndDecodeAttachments([
        { name: 'evil.png', mimeType: 'image/png', dataUrl: `data:image/png;base64,${Buffer.from('MZfakeexe').toString('base64')}` },
      ]),
    /failed image signature verification/
  );

  // Exceeds max attachment count
  const tooMany = Array.from({ length: MAX_CHAT_ATTACHMENTS + 1 }, (_, i) => ({
    name: `img-${i}.png`,
    mimeType: 'image/png',
    dataUrl: `data:image/png;base64,${PNG_BYTES.toString('base64')}`,
  }));
  assert.throws(() => validateAndDecodeAttachments(tooMany), /Too many image attachments/);

  // Exceeds max size
  const huge = Buffer.alloc(MAX_CHAT_IMAGE_BYTES + 8);
  PNG_BYTES.copy(huge, 0);
  assert.throws(
    () =>
      validateAndDecodeAttachments([
        { name: 'huge.png', mimeType: 'image/png', dataUrl: `data:image/png;base64,${huge.toString('base64')}` },
      ]),
    /exceeds maximum size/
  );
});

test('formatAttachmentsSummary formats singular and plural summaries', () => {
  assert.equal(formatAttachmentsSummary([]), '');
  assert.equal(formatAttachmentsSummary([{ name: 'slide.png' }]), '1 attachment: slide.png');
  assert.equal(
    formatAttachmentsSummary([{ name: 'a.png' }, { name: 'b.jpg' }]),
    '2 attachments: a.png, b.jpg'
  );
});

test('materializeTempAttachments, project cleanup, and global cleanup delete all files cleanly', async () => {
  const projA = path.join(process.env.PROJECTS_DIR, 'proj-a');
  const projB = path.join(process.env.PROJECTS_DIR, 'proj-b');
  await fs.mkdir(path.join(projA, '.metadata'), { recursive: true });
  await fs.mkdir(path.join(projB, '.metadata'), { recursive: true });

  const decoded = validateAndDecodeAttachments([
    { name: 'mock.png', mimeType: 'image/png', dataUrl: `data:image/png;base64,${PNG_BYTES.toString('base64')}` },
  ]);

  const matA = await materializeTempAttachments(decoded, { projectId: 'proj-a', projectPath: projA, runId: 'runA' });
  const matB = await materializeTempAttachments(decoded, { projectId: 'proj-b', projectPath: projB, runId: 'runB' });
  const matGlobal = await materializeTempAttachments(decoded, { projectId: null, projectPath: null, runId: 'runGlobal' });

  assert.ok(matA.tempDir.startsWith(path.join(projA, '.metadata', '.tmp-chat')));
  assert.ok(matGlobal.tempDir.startsWith(GLOBAL_TMP_CHAT_DIR));
  assert.equal(await fs.stat(matA.files[0].filePath).then(() => true), true);

  // Switch away from proj-a -> cleans ONLY proj-a
  await cleanupProjectTempAttachments('proj-a', projA);
  await assert.rejects(() => fs.access(matA.tempDir));
  assert.equal(await fs.stat(matB.files[0].filePath).then(() => true), true);

  // Global / shutdown sweep cleans proj-b and global temp dir
  await cleanupAllTempAttachments([{ id: 'proj-a', path: projA }, { id: 'proj-b', path: projB }]);
  await assert.rejects(() => fs.access(matB.tempDir));
  await assert.rejects(() => fs.access(matGlobal.tempDir));
});

test('AgentOrchestrator cleans up CLI temp files in finally across success, error, and abort', async () => {
  const projectId = 'orch-cleanup-proj';
  const projPath = path.join(process.env.PROJECTS_DIR, projectId);
  await fs.mkdir(path.join(projPath, '.metadata'), { recursive: true });
  await fs.writeFile(
    path.join(projPath, '.metadata', 'project.json'),
    JSON.stringify({ id: projectId, name: 'Cleanup Test' })
  );

  const decodedPayload = [{
    name: 'screen.png',
    mimeType: 'image/png',
    dataUrl: `data:image/png;base64,${PNG_BYTES.toString('base64')}`,
  }];

  const origCreateProvider = AIService.createProvider;
  const orchestrator = new AgentOrchestrator();
  let observedTempPaths = [];

  try {
    // 1. Success path
    AIService.createProvider = async () => ({
      providerType: () => 'custom-mock',
      displayName: async () => 'Mock CLI',
      checkAuthentication: async () => true,
      usesTempFilesForImages: () => true,
      resolveModel: async () => 'mock-model',
      chat: async (req) => {
        observedTempPaths = req.messages[0].tempImagePaths.map((i) => i.filePath);
        await fs.access(observedTempPaths[0]);
        return { content: 'Analyzed screen.', metadata: {} };
      },
    });

    await orchestrator.runAgentLoop({
      projectId,
      providerType: 'claudeCode',
      messages: [{ role: 'user', content: '', attachments: decodedPayload }],
    });
    assert.equal(observedTempPaths.length, 1);
    await assert.rejects(() => fs.access(observedTempPaths[0]));

    // 2. Error path
    AIService.createProvider = async () => ({
      providerType: () => 'custom-mock',
      displayName: async () => 'Mock CLI',
      checkAuthentication: async () => true,
      usesTempFilesForImages: () => true,
      resolveModel: async () => 'mock-model',
      chat: async (req) => {
        observedTempPaths = req.messages[0].tempImagePaths.map((i) => i.filePath);
        await fs.access(observedTempPaths[0]);
        throw new Error('CLI crashed');
      },
    });

    const errRes = await orchestrator.runAgentLoop({
      projectId,
      providerType: 'claudeCode',
      messages: [{ role: 'user', content: 'analyze', attachments: decodedPayload }],
    });
    assert.match(errRes.content, /CLI crashed/);
    await assert.rejects(() => fs.access(observedTempPaths[0]));

    // 3. Abort path
    AIService.createProvider = async () => ({
      providerType: () => 'custom-mock',
      displayName: async () => 'Mock CLI',
      checkAuthentication: async () => true,
      usesTempFilesForImages: () => true,
      resolveModel: async () => 'mock-model',
      chat: async (req) => {
        observedTempPaths = req.messages[0].tempImagePaths.map((i) => i.filePath);
        await orchestrator.stopExecution(projectId);
        const err = new Error('Aborted');
        err.name = 'AbortError';
        throw err;
      },
    });

    const abortRes = await orchestrator.runAgentLoop({
      projectId,
      providerType: 'claudeCode',
      messages: [{ role: 'user', content: 'analyze', attachments: decodedPayload }],
    });
    assert.equal(abortRes.metadata.model_used, 'aborted');
    await assert.rejects(() => fs.access(observedTempPaths[0]));
  } finally {
    AIService.createProvider = origCreateProvider;
  }

  // Cleanup manual dir helper check
  await cleanupTempDir(path.join(projPath, '.metadata', '.tmp-chat', 'missing'), projectId);
});

test('cleanupTempDir retries transient errors, preserves failed registrations, and handles partial materialization', async () => {
  const projPath = path.join(process.env.PROJECTS_DIR, 'proj-retry');
  await fs.mkdir(path.join(projPath, '.metadata'), { recursive: true });
  const decoded = validateAndDecodeAttachments([
    { name: 'secret-diagram.png', mimeType: 'image/png', dataUrl: `data:image/png;base64,${PNG_BYTES.toString('base64')}` },
    { name: 'second-shot.png', mimeType: 'image/png', dataUrl: `data:image/png;base64,${PNG_BYTES.toString('base64')}` },
  ]);

  // 1. Transient failure retries and unregisters once deletion succeeds
  const matTransient = await materializeTempAttachments([decoded[0]], {
    projectId: 'proj-retry-transient',
    projectPath: projPath,
    runId: 'transient-run',
  });
  let rmCalls = 0;
  const transientRes = await cleanupTempDir(matTransient.tempDir, 'proj-retry-transient', {
    retryDelayMs: 1,
    rmFn: async (dir, opts) => {
      rmCalls += 1;
      if (rmCalls < 3) {
        const err = new Error('Resource busy');
        err.code = 'EBUSY';
        throw err;
      }
      return fs.rm(dir, opts);
    },
  });
  assert.equal(transientRes.ok, true);
  assert.equal(rmCalls, 3);
  assert.deepEqual(getRegisteredTempDirs('proj-retry-transient'), []);

  // 2. Persistent failure keeps dir registered and reports without exposing media names or data
  const matPersist = await materializeTempAttachments([decoded[0]], {
    projectId: 'proj-retry-persist',
    projectPath: projPath,
    runId: 'persist-run',
  });
  const loggedFailures = [];
  const persistRes = await cleanupTempDir(matPersist.tempDir, 'proj-retry-persist', {
    maxRetries: 1,
    retryDelayMs: 1,
    logger: { error: (...args) => loggedFailures.push(JSON.stringify(args)) },
    rmFn: async () => {
      const err = new Error('Permission denied on secret-diagram.png');
      err.code = 'EACCES';
      throw err;
    },
  });
  assert.equal(persistRes.ok, false);
  assert.deepEqual(getRegisteredTempDirs('proj-retry-persist'), [matPersist.tempDir]);
  assert.equal(loggedFailures.length, 1);
  assert.equal(loggedFailures[0].includes('secret-diagram.png'), false);

  // Project and global cleanup preserve failed entries and unregister once cleanup succeeds
  const projFailRes = await cleanupProjectTempAttachments('proj-retry-persist', projPath, {
    maxRetries: 0,
    retryDelayMs: 0,
    logger: { error: () => {} },
    rmFn: async () => {
      const err = new Error('EPERM');
      err.code = 'EPERM';
      throw err;
    },
  });
  assert.equal(projFailRes.ok, false);
  assert.ok(getRegisteredTempDirs('proj-retry-persist').includes(matPersist.tempDir));

  const recoveredAll = await cleanupAllTempAttachments([{ id: 'proj-retry-persist', path: projPath }]);
  assert.equal(recoveredAll.ok, true);
  assert.deepEqual(getRegisteredTempDirs('proj-retry-persist'), []);

  // 3. Partial materialization failure cleans first written file and tracks failure if cleanup fails
  let writeCount = 0;
  await assert.rejects(
    () =>
      materializeTempAttachments(decoded, {
        projectId: 'proj-partial-ok',
        projectPath: projPath,
        runId: 'partial-ok',
        writeFileFn: async (filePath, buf, opts) => {
          writeCount += 1;
          if (writeCount === 2) throw new Error('ENOSPC');
          return fs.writeFile(filePath, buf, opts);
        },
      }),
    /ENOSPC/
  );
  assert.deepEqual(getRegisteredTempDirs('proj-partial-ok'), []);
  await assert.rejects(() => fs.access(path.join(projPath, '.metadata', '.tmp-chat', 'partial-ok')));

  writeCount = 0;
  await assert.rejects(
    () =>
      materializeTempAttachments(decoded, {
        projectId: 'proj-partial-fail',
        projectPath: projPath,
        runId: 'partial-fail',
        maxRetries: 0,
        retryDelayMs: 0,
        logger: { error: () => {} },
        writeFileFn: async (filePath, buf, opts) => {
          writeCount += 1;
          if (writeCount === 2) throw new Error('Disk failure');
          return fs.writeFile(filePath, buf, opts);
        },
        rmFn: async () => {
          const err = new Error('Busy');
          err.code = 'EBUSY';
          throw err;
        },
      }),
    (err) => err.message === 'Disk failure' && err.cleanupFailed === true
  );
  assert.equal(getRegisteredTempDirs('proj-partial-fail').length, 1);
  await cleanupAllTempAttachments([{ id: 'proj-partial-fail', path: projPath }]);
});

test('MAX_CHAT_REQUEST_BYTES accommodates four max-size 10 MiB Base64 images plus JSON and history overhead', async () => {
  const maxPng = Buffer.alloc(MAX_CHAT_IMAGE_BYTES);
  PNG_BYTES.copy(maxPng, 0);
  const dataUrl = `data:image/png;base64,${maxPng.toString('base64')}`;

  const largePayload = JSON.stringify({
    project_id: 'proj-max-batch',
    messages: [
      { role: 'user', content: 'Previous turn '.repeat(200) },
      { role: 'assistant', content: 'Previous reply '.repeat(200) },
      {
        role: 'user',
        content: 'Analyze all four full-size images',
        attachments: [
          { name: 'img1.png', mimeType: 'image/png', dataUrl },
          { name: 'img2.png', mimeType: 'image/png', dataUrl },
          { name: 'img3.png', mimeType: 'image/png', dataUrl },
          { name: 'img4.png', mimeType: 'image/png', dataUrl },
        ],
      },
    ],
  });

  assert.ok(Buffer.byteLength(largePayload, 'utf8') > 25 * 1024 * 1024);
  assert.ok(Buffer.byteLength(largePayload, 'utf8') < MAX_CHAT_REQUEST_BYTES);

  const parsed = await readJson(Readable.from([largePayload]), { maxBytes: MAX_CHAT_REQUEST_BYTES });
  const validated = validateAndDecodeAttachments(parsed.messages[2].attachments);
  assert.equal(validated.length, 4);
  assert.equal(validated[0].sizeBytes, MAX_CHAT_IMAGE_BYTES);

  await assert.rejects(
    () =>
      readJson(Readable.from([Buffer.alloc(MAX_CHAT_REQUEST_BYTES + 16, 0x61)]), {
        maxBytes: MAX_CHAT_REQUEST_BYTES,
      }),
    { statusCode: 413 }
  );
});

test('materializeTempAttachments honors abort signal and cleans temp directory immediately', async () => {
  const projPath = path.join(process.env.PROJECTS_DIR, 'proj-abort-mat');
  await fs.mkdir(path.join(projPath, '.metadata'), { recursive: true });
  const decoded = validateAndDecodeAttachments([
    { name: 'img1.png', mimeType: 'image/png', dataUrl: `data:image/png;base64,${PNG_BYTES.toString('base64')}` },
    { name: 'img2.png', mimeType: 'image/png', dataUrl: `data:image/png;base64,${PNG_BYTES.toString('base64')}` },
  ]);

  // 1. Pre-aborted signal prevents directory creation or writes
  const preController = new AbortController();
  preController.abort();
  await assert.rejects(
    () =>
      materializeTempAttachments(decoded, {
        projectId: 'proj-abort-pre',
        projectPath: projPath,
        runId: 'abort-pre',
        signal: preController.signal,
      }),
    { name: 'AbortError' }
  );
  await assert.rejects(() => fs.access(path.join(projPath, '.metadata', '.tmp-chat', 'abort-pre')));

  // 2. Abort mid-loop stops subsequent writes and cleans up partial directory
  const midController = new AbortController();
  let writes = 0;
  await assert.rejects(
    () =>
      materializeTempAttachments(decoded, {
        projectId: 'proj-abort-mid',
        projectPath: projPath,
        runId: 'abort-mid',
        signal: midController.signal,
        writeFileFn: async (filePath, buf, opts) => {
          writes += 1;
          await fs.writeFile(filePath, buf, opts);
          midController.abort();
        },
      }),
    { name: 'AbortError' }
  );
  assert.equal(writes, 1);
  assert.deepEqual(getRegisteredTempDirs('proj-abort-mid'), []);
  await assert.rejects(() => fs.access(path.join(projPath, '.metadata', '.tmp-chat', 'abort-mid')));
});
