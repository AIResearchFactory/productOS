import { EventEmitter } from 'node:events';
import { ALLOWED_EVENT_NAMES, TELEMETRY_EVENTS } from './catalog.mjs';

export const telemetryEmitter = new EventEmitter();

const MAX_VALUE_LENGTH = 256;

export function isTelemetryEnabled(settings = {}) {
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

function errorCode(error) {
  if (!error) return 'unknown';
  if (typeof error.code === 'string') return error.code.slice(0, MAX_VALUE_LENGTH);
  if (typeof error.name === 'string') return error.name.slice(0, MAX_VALUE_LENGTH);
  return 'error';
}

export async function trackTelemetry(name, payload = {}, settings = {}, options = { broadcast: true }) {
  if (!isTelemetryEnabled(settings)) return false;

  const sanitized = sanitizeEvent(name, payload);
  if (!sanitized) return false;

  try {
    // Emit event for SSE broadcasting
    if (options?.broadcast !== false) {
      telemetryEmitter.emit('event', { name: sanitized.name, payload: sanitized.payload });
    }
    return true;
  } catch (error) {
    console.warn('[telemetry] Failed to track event:', error.message);
    return false;
  }
}

export function telemetryErrorCode(error) {
  return errorCode(error);
}
