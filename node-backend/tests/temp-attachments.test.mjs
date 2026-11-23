import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

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
  GLOBAL_TMP_CHAT_DIR,
  detectImageMagicMime,
  sanitizeAttachmentName,
  validateAndDecodeAttachments,
  formatAttachmentsSummary,
  materializeTempAttachments,
  cleanupTempDir,
  cleanupProjectTempAttachments,
  cleanupAllTempAttachments,
} = await import('../lib/temp-attachments.mjs');
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
