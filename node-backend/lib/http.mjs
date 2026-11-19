import { URL } from 'node:url';
import { safeJsonParse, DEFAULT_MAX_JSON_BYTES } from './safe-json.mjs';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const ALLOWED_HOST_REGEX = /^(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/i;

export function isAllowedHost(hostHeader) {
  if (!hostHeader) return true;
  const raw = String(hostHeader).trim().toLowerCase();
  if (ALLOWED_HOST_REGEX.test(raw)) return true;

  const extra = process.env.PRODUCTOS_ALLOWED_HOST;
  if (extra) {
    const allowed = extra.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
    const hostnameOnly = raw.replace(/:\d+$/, '');
    if (allowed.includes(raw) || allowed.includes(hostnameOnly)) {
      return true;
    }
  }
  return false;
}

export function getAllowedOrigin(originHeader) {
  if (originHeader === undefined || originHeader === null || originHeader === '') {
    return null;
  }
  let parsed;
  try {
    parsed = new URL(String(originHeader));
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (LOOPBACK_HOSTS.has(hostname)) {
    return parsed.origin;
  }

  const extra = process.env.PRODUCTOS_ALLOWED_ORIGINS;
  if (extra) {
    const allowed = extra.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
    if (allowed.includes(parsed.origin.toLowerCase()) || allowed.includes(hostname)) {
      return parsed.origin;
    }
  }

  return false;
}

export function validateLocalRequest(req, res) {
  if (!isAllowedHost(req.headers?.host)) {
    if (res) sendError(res, 403, 'Forbidden host');
    return false;
  }

  const allowedOrigin = getAllowedOrigin(req.headers?.origin);
  if (allowedOrigin === false) {
    if (res) sendError(res, 403, 'Forbidden origin');
    return false;
  }

  const secFetchSite = String(req.headers?.['sec-fetch-site'] || '').trim().toLowerCase();
  // Allow cross-origin requests between localhost and 127.0.0.1 when Origin is a verified loopback origin
  if (!allowedOrigin && secFetchSite === 'cross-site') {
    if (res) sendError(res, 403, 'Forbidden cross-site request');
    return false;
  }

  if (res) {
    res._allowedOrigin = allowedOrigin;
  }
  return true;
}

export function getSecurityHeaders(res, extraHeaders = {}) {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cross-Origin-Resource-Policy': 'same-site',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  };

  if (res?._allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = res._allowedOrigin;
    headers['Vary'] = 'Origin';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS';
  }

  return { ...headers, ...extraHeaders };
}

export async function readJson(req, options = {}) {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_JSON_BYTES;
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buf.length;
    if (totalBytes > maxBytes) {
      try {
        req.pause?.();
      } catch {
        // Ignore pause errors on synthetic streams
      }
      const err = new Error(`Request body exceeds maximum size of ${maxBytes} bytes`);
      err.statusCode = 413;
      throw err;
    }
    chunks.push(buf);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) {
    return {};
  }

  try {
    return safeJsonParse(raw, { maxBytes });
  } catch (e) {
    if (e?.statusCode === 413) {
      throw e;
    }
    const err = new Error('Invalid JSON body');
    err.statusCode = 400;
    throw err;
  }
}

export function sendJson(res, status, body, extraHeaders = {}) {
  if (res.headersSent || res.writableEnded) return;
  const payload = JSON.stringify(body);
  res.writeHead(
    status,
    getSecurityHeaders(res, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
      ...extraHeaders,
    })
  );
  res.end(payload);
}

export function sendNoContent(res, status = 204, extraHeaders = {}) {
  if (res.headersSent || res.writableEnded) return;
  res.writeHead(status, getSecurityHeaders(res, extraHeaders));
  res.end();
}

export function sendError(res, status, error, details, extraHeaders = {}) {
  sendJson(res, status, details ? { error, details } : { error }, extraHeaders);
}

export function getUrl(req) {
  const url = new URL(req.url, 'http://127.0.0.1');
  // Normalize double slashes
  url.pathname = url.pathname.replace(/\/+/g, '/');
  return url;
}
