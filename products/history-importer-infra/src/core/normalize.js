import { SUPPORTED_ROLES } from './types.js';

export function safeIso(input, fallback = new Date(0).toISOString()) {
  if (!input) return fallback;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
}

export function normalizeRole(role) {
  if (!role) return 'user';
  const normalized = String(role).toLowerCase();
  return SUPPORTED_ROLES.has(normalized) ? normalized : 'user';
}

export function asText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        if (typeof v === 'string') return v;
        if (v?.text) return String(v.text);
        if (v?.content) return String(v.content);
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  if (typeof value === 'object') {
    if (value.text) return String(value.text);
    if (value.content) return asText(value.content);
  }
  return String(value);
}
