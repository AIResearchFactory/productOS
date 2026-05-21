import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { getAppDataDir } from '../paths.mjs';
import { ALLOWED_EVENT_NAMES, TELEMETRY_EVENTS } from './catalog.mjs';
import packageJson from '../../../package.json' with { type: 'json' };

const SESSION_ID = crypto.randomUUID();
const MAX_VALUE_LENGTH = 256;
const MAX_BATCH_SIZE = 25;
const FLUSH_TIMEOUT_MS = 5000;
const DEFAULT_ENDPOINT = '';

let statePromise = null;
let flushPromise = null;

function envDisabled() {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env.PRODUCTOS_TELEMETRY_DISABLED || '').toLowerCase());
}

function configuredEndpoint() {
  return (process.env.PRODUCTOS_TELEMETRY_ENDPOINT || DEFAULT_ENDPOINT).trim();
}

export function isTelemetryEnabled(settings = {}) {
  if (envDisabled()) return false;
  if (settings?.telemetry?.enabled === false) return false;
  return true;
}

function normalizeValue(value) {
  if (typeof value === 'string') return value.slice(0, MAX_VALUE_LENGTH);
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'boolean') return value;
  if (value == null) return undefined;
  return String(value).slice(0, MAX_VALUE_LENGTH);
}

export function sanitizeEvent(name, payload = {}) {
  if (!ALLOWED_EVENT_NAMES.has(name)) return null;
  const allowedKeys = TELEMETRY_EVENTS[name] || [];
  const sanitizedPayload = {};

  for (const key of allowedKeys) {
    const value = normalizeValue(payload[key]);
    if (value !== undefined) sanitizedPayload[key] = value;
  }

  return { name, payload: sanitizedPayload };
}

async function telemetryDir() {
  return path.join(await getAppDataDir(), 'telemetry');
}

async function statePath() {
  return path.join(await telemetryDir(), 'telemetry.json');
}

async function queuePath() {
  return path.join(await telemetryDir(), 'queue.ndjson');
}

async function getState() {
  if (statePromise) return statePromise;

  statePromise = (async () => {
    const dir = await telemetryDir();
    await fs.mkdir(dir, { recursive: true });
    const file = await statePath();

    try {
      const state = JSON.parse(await fs.readFile(file, 'utf8'));
      if (state?.installId) return state;
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        console.warn('[telemetry] Failed to read telemetry state:', error.message);
      }
    }

    const state = { installId: crypto.randomUUID(), createdAt: new Date().toISOString() };
    await fs.writeFile(file, JSON.stringify(state, null, 2), 'utf8');
    return state;
  })();

  return statePromise;
}

async function appendQueue(event) {
  const file = await queuePath();
  await fs.appendFile(file, `${JSON.stringify(event)}\n`, 'utf8');
}

async function readQueue() {
  const file = await queuePath();
  try {
    const raw = await fs.readFile(file, 'utf8');
    return raw.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeQueue(events) {
  const file = await queuePath();
  if (events.length === 0) {
    await fs.rm(file, { force: true });
    return;
  }
  await fs.writeFile(file, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`, 'utf8');
}

function withoutDeliveredEvents(events, delivered) {
  const deliveredIds = new Set(delivered.map((event) => event.queueId).filter(Boolean));
  const deliveredByValue = new Map();

  for (const event of delivered) {
    if (event.queueId) continue;
    const key = JSON.stringify(event);
    deliveredByValue.set(key, (deliveredByValue.get(key) || 0) + 1);
  }

  return events.filter((event) => {
    if (event.queueId && deliveredIds.has(event.queueId)) return false;
    const key = JSON.stringify(event);
    const count = deliveredByValue.get(key) || 0;
    if (count === 0) return true;
    if (count === 1) deliveredByValue.delete(key);
    else deliveredByValue.set(key, count - 1);
    return false;
  });
}

function errorCode(error) {
  if (!error) return 'unknown';
  if (typeof error.code === 'string') return error.code.slice(0, MAX_VALUE_LENGTH);
  if (typeof error.name === 'string') return error.name.slice(0, MAX_VALUE_LENGTH);
  return 'error';
}

export async function trackTelemetry(name, payload = {}, settings = {}) {
  if (!isTelemetryEnabled(settings)) return false;

  const sanitized = sanitizeEvent(name, payload);
  if (!sanitized) return false;

  try {
    const state = await getState();
    await appendQueue({
      queueId: crypto.randomUUID(),
      installId: state.installId,
      sessionId: SESSION_ID,
      clientVersion: packageJson.version,
      platform: 'node',
      nodeVersion: process.version,
      os: process.platform,
      arch: process.arch,
      event: sanitized.name,
      payload: sanitized.payload,
      timestamp: new Date().toISOString(),
    });

    void flushTelemetry(settings);
    return true;
  } catch (error) {
    console.warn('[telemetry] Failed to queue event:', error.message);
    return false;
  }
}

export async function flushTelemetry(settings = {}) {
  if (!isTelemetryEnabled(settings)) return false;
  const endpoint = configuredEndpoint();
  if (!endpoint) return false;
  if (flushPromise) return flushPromise;

  flushPromise = (async () => {
    try {
      const queued = await readQueue();
      if (queued.length === 0) return true;

      const batch = queued.slice(0, MAX_BATCH_SIZE);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FLUSH_TIMEOUT_MS);
      let response;
      try {
        response = await fetch(endpoint, {
          signal: controller.signal,
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'user-agent': `productos/${packageJson.version} (${os.platform()}; ${os.arch()})`,
          },
          body: JSON.stringify({ events: batch }),
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) throw new Error(`telemetry endpoint returned ${response.status}`);
      const latest = await readQueue();
      const preserved = withoutDeliveredEvents(latest, batch);
      await writeQueue(preserved);
      return true;
    } catch (error) {
      console.warn('[telemetry] Flush failed; events will be retried later:', errorCode(error));
      return false;
    } finally {
      flushPromise = null;
    }
  })();

  return flushPromise;
}

export function telemetryErrorCode(error) {
  return errorCode(error);
}
