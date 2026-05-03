import { URL } from 'node:url';

export async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('[HTTP] Failed to parse JSON body:', raw);
    return {};
  }
}

export function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  });
  res.end(payload);
}

export function sendNoContent(res, status = 204) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  });
  res.end();
}

export function sendError(res, status, error, details) {
  sendJson(res, status, details ? { error, details } : { error });
}

export function getUrl(req) {
  const url = new URL(req.url, 'http://127.0.0.1');
  // Normalize double slashes
  url.pathname = url.pathname.replace(/\/+/g, '/');
  return url;
}
