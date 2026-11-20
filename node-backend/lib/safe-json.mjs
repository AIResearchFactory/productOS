const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export const DEFAULT_MAX_JSON_BYTES = 10 * 1024 * 1024;

export function isSafeKey(key) {
  return typeof key === 'string' && key.length > 0 && !UNSAFE_KEYS.has(key);
}

export function stripPrototypeKeys(key, value) {
  if (UNSAFE_KEYS.has(key)) {
    return undefined;
  }
  return value;
}

export function safeJsonParse(raw, options = {}) {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_JSON_BYTES;
  if (typeof raw !== 'string') {
    const err = new Error('JSON input must be a string');
    err.statusCode = 400;
    throw err;
  }
  if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
    const err = new Error(`JSON payload exceeds maximum size of ${maxBytes} bytes`);
    err.statusCode = 413;
    throw err;
  }
  return JSON.parse(raw, stripPrototypeKeys);
}
