import fs from 'node:fs/promises';
import path from 'node:path';
import { getProjectById } from '../projects.mjs';
import { safeJoin } from '../paths.mjs';

export const LOG_FILE_NAME = 'log.md';
export const KNOWLEDGE_EVENT_TYPES = new Set(['import', 'create', 'update', 'delete', 'enrich', 'learn', 'lint', 'convert', 'reconcile']);

function normalizeEventType(type) {
  const value = String(type || 'learn').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  return value || 'learn';
}

function cleanInline(value) {
  return String(value ?? '')
    .replace(/\r?\n+/g, ' ')
    .replace(/\|/g, '\\|')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRelPath(relPath) {
  return String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function formatMarkdownLink(relPath) {
  return normalizeRelPath(relPath).split('/').map(encodeURIComponent).join('/');
}

function formatDetails(details = {}) {
  const parts = [];
  if (details.artifact || details.artifactId || details.path) {
    const artifact = details.artifact || {};
    const relPath = normalizeRelPath(details.path || artifact.path || artifact.id || details.artifactId);
    const title = cleanInline(details.title || artifact.title || path.parse(relPath).name || relPath);
    if (relPath) parts.push(`artifact: [${title}](${formatMarkdownLink(relPath)})`);
    else if (title) parts.push(`artifact: ${title}`);
  }
  if (details.message) parts.push(`message: ${cleanInline(details.message)}`);
  if (details.reason) parts.push(`reason: ${cleanInline(details.reason)}`);
  if (details.count !== undefined) parts.push(`count: ${details.count}`);
  if (details.source) parts.push(`source: ${cleanInline(details.source)}`);

  const extra = Object.entries(details)
    .filter(([key, value]) => !['artifact', 'artifactId', 'path', 'title', 'message', 'reason', 'count', 'source'].includes(key) && value !== undefined && value !== null)
    .map(([key, value]) => `${cleanInline(key)}: ${cleanInline(typeof value === 'object' ? JSON.stringify(value) : value)}`);
  parts.push(...extra);
  return parts.join(' | ') || 'event recorded';
}

export function formatKnowledgeLogEntry(eventType, details = {}, now = new Date()) {
  const type = normalizeEventType(eventType);
  const timestamp = now.toISOString();
  return `- ${timestamp} | ${type} | ${formatDetails(details)}`;
}

async function ensureLogHeader(logPath) {
  try {
    await fs.access(logPath);
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
    await fs.writeFile(
      logPath,
      '# Knowledge Event Log\n\n<!-- Append-only Silent Learner event stream. One grep-friendly markdown bullet per event. -->\n\n',
      'utf8'
    );
  }
}

export async function appendKnowledgeLog(projectId, eventType, details = {}) {
  const project = await getProjectById(projectId);
  const logPath = await safeJoin(project.path, LOG_FILE_NAME);
  await ensureLogHeader(logPath);
  const entry = formatKnowledgeLogEntry(eventType, details);
  await fs.appendFile(logPath, `${entry}\n`, 'utf8');
  return { path: LOG_FILE_NAME, entry };
}

export async function getKnowledgeLog(projectId, options = {}) {
  const project = await getProjectById(projectId);
  const logPath = await safeJoin(project.path, LOG_FILE_NAME);
  let content = '';
  try {
    content = await fs.readFile(logPath, 'utf8');
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
  }

  const entries = content
    .split(/\r?\n/)
    .filter((line) => line.startsWith('- '));
  const offset = Math.max(0, Number.parseInt(options.offset ?? 0, 10) || 0);
  const limitRaw = Number.parseInt(options.limit ?? 100, 10);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 100, 1), 500);
  const page = entries.slice(offset, offset + limit);

  return {
    path: LOG_FILE_NAME,
    content,
    entries: page,
    offset,
    limit,
    total: entries.length,
    hasMore: offset + limit < entries.length,
    nextOffset: offset + limit < entries.length ? offset + limit : null,
  };
}
