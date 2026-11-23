import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const MAX_CHAT_ATTACHMENTS = 4;
export const MAX_CHAT_IMAGE_BYTES = 10 * 1024 * 1024;
/** 64 MiB transport cap covers up to 4 × 10 MiB Base64-encoded images (~53.3 MiB) plus JSON & history overhead. */
export const MAX_CHAT_REQUEST_BYTES = 64 * 1024 * 1024;
export const ALLOWED_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

export const TMP_CHAT_DIR_NAME = '.tmp-chat';
export const GLOBAL_TMP_CHAT_DIR = path.join(os.tmpdir(), 'productos-chat-tmp');

/** In-memory registry of active temp directories keyed by projectId or '__global__'. */
const activeTempDirs = new Map();

function registryKey(projectId) {
  return projectId || '__global__';
}

function registerTempDir(projectId, dirPath) {
  const key = registryKey(projectId);
  if (!activeTempDirs.has(key)) {
    activeTempDirs.set(key, new Set());
  }
  activeTempDirs.get(key).add(dirPath);
}

function unregisterTempDir(projectId, dirPath) {
  const key = registryKey(projectId);
  const set = activeTempDirs.get(key);
  if (!set) return;
  set.delete(dirPath);
  if (set.size === 0) {
    activeTempDirs.delete(key);
  }
}

export function getRegisteredTempDirs(projectId) {
  const set = activeTempDirs.get(registryKey(projectId));
  return set ? Array.from(set) : [];
}

/**
 * Normalize image MIME aliases (e.g. image/jpg -> image/jpeg).
 *
 * @param {unknown} mime
 * @returns {string}
 */
export function normalizeImageMime(mime) {
  const lower = String(mime || '').trim().toLowerCase();
  if (lower === 'image/jpg') return 'image/jpeg';
  return lower;
}

/**
 * Detect actual image MIME type from binary magic bytes.
 *
 * @param {Buffer} buffer
 * @returns {'image/png'|'image/jpeg'|'image/gif'|'image/webp'|null}
 */
export function detectImageMagicMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    return null;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // GIF: GIF87a or GIF89a
  if (buffer.length >= 6) {
    const header = buffer.subarray(0, 6).toString('ascii');
    if (header === 'GIF87a' || header === 'GIF89a') {
      return 'image/gif';
    }
  }

  // WebP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

export function extensionForImageMime(mimeType) {
  switch (normalizeImageMime(mimeType)) {
    case 'image/png':
      return '.png';
    case 'image/jpeg':
      return '.jpg';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    default:
      return '.bin';
  }
}

/**
 * Sanitize an attachment filename into a safe basename with a matching image extension.
 *
 * @param {unknown} rawName
 * @param {number} index
 * @param {string} mimeType
 * @returns {string}
 */
export function sanitizeAttachmentName(rawName, index, mimeType) {
  const extFallback = extensionForImageMime(mimeType);
  const rawStr = typeof rawName === 'string' ? rawName.replace(/\0/g, '').trim() : '';
  const baseOnly = rawStr.split(/[/\\]/).pop() || '';
  const cleaned = baseOnly
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 80);

  if (!cleaned || cleaned === '.' || cleaned === '..') {
    return `image-${index + 1}${extFallback}`;
  }

  const parsed = path.posix.parse(cleaned);
  const stem = (parsed.name || `image-${index + 1}`).replace(/\.+$/, '') || `image-${index + 1}`;
  const lowerExt = (parsed.ext || '').toLowerCase();
  const validExt =
    (mimeType === 'image/jpeg' && (lowerExt === '.jpg' || lowerExt === '.jpeg')) ||
    lowerExt === extFallback
      ? lowerExt
      : extFallback;

  return `${stem.slice(0, 64)}${validExt}`;
}

function createValidationError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * Validate raw attachment payloads, verify magic bytes, and return normalized descriptors.
 *
 * @param {unknown} rawAttachments
 * @returns {Array<{ id: string, name: string, mimeType: string, sizeBytes: number, base64: string, dataUrl: string, buffer: Buffer }>}
 */
export function validateAndDecodeAttachments(rawAttachments) {
  if (rawAttachments === undefined || rawAttachments === null) {
    return [];
  }
  if (!Array.isArray(rawAttachments)) {
    throw createValidationError('attachments must be an array', 400);
  }
  if (rawAttachments.length === 0) {
    return [];
  }
  if (rawAttachments.length > MAX_CHAT_ATTACHMENTS) {
    throw createValidationError(
      `Too many image attachments (max ${MAX_CHAT_ATTACHMENTS} per message)`,
      400
    );
  }

  return rawAttachments.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw createValidationError(`Attachment at index ${index} must be an object`, 400);
    }

    let declaredMime = normalizeImageMime(item.mimeType);
    let rawBase64 = '';

    if (typeof item.dataUrl === 'string' && item.dataUrl.trim()) {
      const match = item.dataUrl.trim().match(/^data:([^;]+);base64,([A-Za-z0-9+/=\s]+)$/i);
      if (!match) {
        throw createValidationError(`Attachment ${index + 1} has invalid dataUrl encoding`, 400);
      }
      declaredMime = normalizeImageMime(match[1]);
      rawBase64 = match[2].replace(/\s+/g, '');
    } else if (typeof item.base64 === 'string' && item.base64.trim()) {
      rawBase64 = item.base64.trim().replace(/\s+/g, '');
    } else {
      throw createValidationError(`Attachment ${index + 1} is missing image data`, 400);
    }

    if (!ALLOWED_IMAGE_MIMES.has(declaredMime)) {
      throw createValidationError(
        `Unsupported image format "${declaredMime || 'unknown'}". Allowed: PNG, JPEG, WebP, GIF.`,
        400
      );
    }

    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(rawBase64)) {
      throw createValidationError(`Attachment ${index + 1} contains invalid base64 characters`, 400);
    }

    const buffer = Buffer.from(rawBase64, 'base64');
    if (buffer.length === 0) {
      throw createValidationError(`Attachment ${index + 1} is empty`, 400);
    }
    if (buffer.length > MAX_CHAT_IMAGE_BYTES) {
      throw createValidationError(
        `Attachment ${index + 1} exceeds maximum size of ${MAX_CHAT_IMAGE_BYTES / (1024 * 1024)} MB`,
        400
      );
    }

    const actualMime = detectImageMagicMime(buffer);
    if (!actualMime || actualMime !== declaredMime) {
      throw createValidationError(
        `Attachment ${index + 1} failed image signature verification (expected ${declaredMime})`,
        400
      );
    }

    const canonicalBase64 = buffer.toString('base64');
    const safeName = sanitizeAttachmentName(item.name, index, declaredMime);

    return {
      id: typeof item.id === 'string' && item.id.trim() ? item.id.trim().slice(0, 80) : randomUUID(),
      name: safeName,
      mimeType: declaredMime,
      sizeBytes: buffer.length,
      base64: canonicalBase64,
      dataUrl: `data:${declaredMime};base64,${canonicalBase64}`,
      buffer,
    };
  });
}

/**
 * Format lightweight text summary for chat history and research logs.
 *
 * @param {Array<{ name: string }>} attachmentsMeta
 * @returns {string}
 */
export function formatAttachmentsSummary(attachmentsMeta) {
  if (!Array.isArray(attachmentsMeta) || attachmentsMeta.length === 0) {
    return '';
  }
  const names = attachmentsMeta
    .map((item) => (typeof item === 'string' ? item : item?.name))
    .filter(Boolean);
  if (names.length === 0) {
    return '';
  }
  const noun = names.length === 1 ? 'attachment' : 'attachments';
  return `${names.length} ${noun}: ${names.join(', ')}`;
}

const TRANSIENT_RM_ERROR_CODES = new Set([
  'EBUSY',
  'ENOTEMPTY',
  'EPERM',
  'EACCES',
  'EMFILE',
  'ENFILE',
  'EAGAIN',
]);

function reportCleanupFailure(scope, dirPath, error, logger = console) {
  logger?.error?.('[temp-attachments] Failed to remove temporary attachment directory', {
    scope,
    dirName: path.basename(String(dirPath || '')),
    code: error?.code || 'UNKNOWN',
  });
}

async function removeDirWithRetry(dirPath, options = {}) {
  const rmFn = options.rmFn || fs.rm;
  const maxRetries = Number.isInteger(options.maxRetries) ? options.maxRetries : 3;
  const retryDelayMs = typeof options.retryDelayMs === 'number' ? options.retryDelayMs : 40;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await rmFn(dirPath, { recursive: true, force: true });
      return { ok: true, dirPath };
    } catch (err) {
      if (err?.code === 'ENOENT') {
        return { ok: true, dirPath };
      }
      lastError = err;
      const isTransient = !err?.code || TRANSIENT_RM_ERROR_CODES.has(err.code);
      if (!isTransient || attempt >= maxRetries) {
        break;
      }
      if (retryDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
      }
    }
  }

  return { ok: false, dirPath, error: lastError };
}

function unregisterDirsUnderRoot(projectId, rootPath) {
  const normalizedRoot = path.resolve(rootPath);
  const keys = projectId === undefined ? Array.from(activeTempDirs.keys()) : [registryKey(projectId)];
  for (const key of keys) {
    const set = activeTempDirs.get(key);
    if (!set) continue;
    for (const dir of Array.from(set)) {
      const resolvedDir = path.resolve(dir);
      if (resolvedDir === normalizedRoot || resolvedDir.startsWith(normalizedRoot + path.sep)) {
        set.delete(dir);
      }
    }
    if (set.size === 0) {
      activeTempDirs.delete(key);
    }
  }
}

/**
 * Write validated images to ephemeral temporary files for CLI providers.
 *
 * @param {Array<{ name: string, mimeType: string, sizeBytes: number, buffer: Buffer }>} validatedAttachments
 * @param {{ projectId?: string|null, projectPath?: string|null, runId?: string, writeFileFn?: Function, rmFn?: Function, maxRetries?: number, retryDelayMs?: number, logger?: { error?: Function } }} [options]
 * @returns {Promise<{ tempDir: string, isExternalToProject: boolean, files: Array<{ name: string, mimeType: string, sizeBytes: number, filePath: string }> }>}
 */
export async function materializeTempAttachments(validatedAttachments, options = {}) {
  const { projectId = null, projectPath = null, writeFileFn = fs.writeFile } = options;
  const rawRunId = typeof options.runId === 'string' && options.runId.trim()
    ? options.runId.replace(/[^a-zA-Z0-9_-]/g, '')
    : randomUUID();
  const safeRunId = rawRunId || randomUUID();

  const rootDir = projectPath
    ? path.join(projectPath, '.metadata', TMP_CHAT_DIR_NAME)
    : GLOBAL_TMP_CHAT_DIR;
  const tempDir = path.join(rootDir, safeRunId);

  await fs.mkdir(tempDir, { recursive: true, mode: 0o700 });
  registerTempDir(projectId, tempDir);

  const files = [];
  try {
    for (let i = 0; i < validatedAttachments.length; i++) {
      const att = validatedAttachments[i];
      const fileName = `${String(i + 1).padStart(2, '0')}_${att.name}`;
      const filePath = path.join(tempDir, fileName);
      await writeFileFn(filePath, att.buffer, { mode: 0o600 });
      files.push({
        name: att.name,
        mimeType: att.mimeType,
        sizeBytes: att.sizeBytes,
        filePath,
      });
    }
    return {
      tempDir,
      isExternalToProject: !projectPath,
      files,
    };
  } catch (err) {
    const cleanupResult = await cleanupTempDir(tempDir, projectId, options);
    if (!cleanupResult.ok) {
      err.cleanupFailed = true;
    }
    throw err;
  }
}

/**
 * Remove a single ephemeral temp attachment directory.
 *
 * @param {string|null|undefined} tempDir
 * @param {string|null} [projectId]
 * @param {{ rmFn?: Function, maxRetries?: number, retryDelayMs?: number, logger?: { error?: Function } }} [options]
 */
export async function cleanupTempDir(tempDir, projectId = null, options = {}) {
  if (!tempDir) return { ok: true, removed: false };
  const res = await removeDirWithRetry(tempDir, options);
  if (!res.ok) {
    registerTempDir(projectId, tempDir);
    reportCleanupFailure('temp-dir', tempDir, res.error, options.logger);
    return { ok: false, removed: false, dirPath: tempDir, error: res.error };
  }
  unregisterTempDir(projectId, tempDir);
  return { ok: true, removed: true };
}

/**
 * Remove all ephemeral chat temp directories associated with a specific project.
 *
 * @param {string|null} projectId
 * @param {string|null} [projectPath]
 * @param {{ rmFn?: Function, maxRetries?: number, retryDelayMs?: number, logger?: { error?: Function } }} [options]
 */
export async function cleanupProjectTempAttachments(projectId, projectPath = null, options = {}) {
  const registered = getRegisteredTempDirs(projectId);
  const results = await Promise.all(
    registered.map((dir) => cleanupTempDir(dir, projectId, options))
  );
  const failures = results.filter((r) => !r.ok);

  if (projectPath) {
    const projectTmpRoot = path.join(projectPath, '.metadata', TMP_CHAT_DIR_NAME);
    const rootRes = await removeDirWithRetry(projectTmpRoot, options);
    if (!rootRes.ok) {
      registerTempDir(projectId, projectTmpRoot);
      reportCleanupFailure('project-temp-root', projectTmpRoot, rootRes.error, options.logger);
      failures.push({ ok: false, removed: false, dirPath: projectTmpRoot, error: rootRes.error });
    } else {
      unregisterDirsUnderRoot(projectId, projectTmpRoot);
    }
  }

  return { ok: failures.length === 0, failures };
}

/**
 * Remove all ephemeral chat temp directories across active registry, OS tmpdir, and all projects.
 *
 * @param {Array<{ id?: string, path?: string }>} [projects]
 * @param {{ rmFn?: Function, maxRetries?: number, retryDelayMs?: number, logger?: { error?: Function } }} [options]
 */
export async function cleanupAllTempAttachments(projects = [], options = {}) {
  const failures = [];
  const snapshot = Array.from(activeTempDirs.entries()).map(([key, dirs]) => [
    key,
    Array.from(dirs),
  ]);

  const trackedTasks = [];
  for (const [key, dirs] of snapshot) {
    const projectId = key === '__global__' ? null : key;
    for (const dir of dirs) {
      trackedTasks.push(cleanupTempDir(dir, projectId, options));
    }
  }
  const trackedResults = await Promise.all(trackedTasks);
  for (const res of trackedResults) {
    if (!res.ok) failures.push(res);
  }

  const globalRes = await removeDirWithRetry(GLOBAL_TMP_CHAT_DIR, options);
  if (!globalRes.ok) {
    registerTempDir(null, GLOBAL_TMP_CHAT_DIR);
    reportCleanupFailure('global-temp-root', GLOBAL_TMP_CHAT_DIR, globalRes.error, options.logger);
    failures.push({ ok: false, removed: false, dirPath: GLOBAL_TMP_CHAT_DIR, error: globalRes.error });
  } else {
    unregisterDirsUnderRoot(undefined, GLOBAL_TMP_CHAT_DIR);
  }

  if (Array.isArray(projects)) {
    const projectTasks = projects
      .filter((proj) => proj?.path)
      .map(async (proj) => {
        const projectTmpRoot = path.join(proj.path, '.metadata', TMP_CHAT_DIR_NAME);
        const rootRes = await removeDirWithRetry(projectTmpRoot, options);
        if (!rootRes.ok) {
          registerTempDir(proj.id || null, projectTmpRoot);
          reportCleanupFailure('project-temp-root', projectTmpRoot, rootRes.error, options.logger);
          failures.push({ ok: false, removed: false, dirPath: projectTmpRoot, error: rootRes.error });
        } else {
          unregisterDirsUnderRoot(proj.id || null, projectTmpRoot);
        }
      });
    await Promise.all(projectTasks);
  }

  return { ok: failures.length === 0, failures };
}
