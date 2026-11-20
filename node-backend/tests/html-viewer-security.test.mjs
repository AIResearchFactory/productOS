import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('SafeHtmlViewer enforces strict XSS protection and iframe sandboxing', async () => {
  const viewerPath = path.resolve('src/components/workspace/SafeHtmlViewer.tsx');
  const content = await fs.readFile(viewerPath, 'utf8');

  // Verify iframe sandbox does NOT include allow-same-origin
  assert.equal(content.includes('allow-same-origin'), false, 'iframe sandbox must NEVER include allow-same-origin');

  // Verify strict Content-Security-Policy directives are injected
  assert.equal(content.includes("default-src 'none'"), true, 'Must enforce default-src none');
  assert.equal(content.includes("connect-src 'none'"), true, 'Must block outbound fetch/XHR exfiltration');
  assert.equal(content.includes("object-src 'none'"), true, 'Must block plugin objects');
  assert.equal(content.includes("base-uri 'none'"), true, 'Must block base tag hijacking');
  assert.equal(content.includes("form-action 'none'"), true, 'Must block form submissions');

  // Verify referrerPolicy is set to no-referrer
  assert.equal(content.includes('referrerPolicy="no-referrer"'), true, 'Must set referrerPolicy="no-referrer"');

  // Verify event handlers and javascript: URIs are stripped in Static Safe Mode
  assert.equal(content.includes("name.startsWith('on')"), true, 'Must strip on* inline event handlers');
  assert.equal(content.includes("val.startsWith('javascript:')"), true, 'Must strip javascript: URIs');

  // Verify DOMPurify, template scrubbing, fail-closed catch, and tightened CSP directives
  assert.equal(content.includes("DOMPurify.sanitize"), true, 'Must sanitize HTML via DOMPurify');
  assert.equal(content.includes("FAIL_CLOSED_HTML"), true, 'Must fail closed on sanitization error instead of returning rawHtml');
  assert.equal(content.includes("img-src data: blob:"), true, 'Must restrict img-src to data: and blob: without arbitrary HTTP/HTTPS tracking');
  assert.equal(content.includes("allowScripts ? \"script-src 'unsafe-inline'\" : \"script-src 'none'\""), true, 'Must not allow remote https: scripts in script-src');
});
