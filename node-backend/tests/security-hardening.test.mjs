import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';

process.env.NODE_ENV = 'test';

const { assertSafeId, isPathInside, safeJoin } = await import('../lib/paths.mjs');
const { safeJsonParse } = await import('../lib/safe-json.mjs');
const { getSecurityHeaders, readJson, validateLocalRequest } = await import('../lib/http.mjs');
const { packZip, unpackZip } = await import('../lib/zip-utils.mjs');
const { renderSkill, parseSkillsImportArgs } = await import('../lib/skills.mjs');
const { matchGlob, redactSecrets, scanForSecrets } = await import('../lib/silent-learner/privacy-filter.mjs');
const { OutputParserService } = await import('../lib/output-parser.mjs');
const { extractAndParseJson } = await import('../../src/lib/jsonUtils.js');
const { normalizeRelativePath, resolveProjectLink } = await import('../../src/lib/projectLinks.js');

test('assertSafeId rejects path separators, traversal segments, and control characters', () => {
  assert.equal(assertSafeId('valid-id_1.0'), 'valid-id_1.0');
  assert.throws(() => assertSafeId(''), { statusCode: 400 });
  assert.throws(() => assertSafeId('..'), { statusCode: 400 });
  assert.throws(() => assertSafeId('.'), { statusCode: 400 });
  assert.throws(() => assertSafeId('a/b'), { statusCode: 400 });
  assert.throws(() => assertSafeId('a\\b'), { statusCode: 400 });
  assert.throws(() => assertSafeId('foo\0bar'), { statusCode: 400 });
  assert.throws(() => assertSafeId('a..b'), { statusCode: 400 });
});

test('safeJoin prevents symlink escape on both existing and non-existent targets while allowing valid files', async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sec-safejoin-'));
  t.after(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const projectRoot = path.join(tempDir, 'project');
  const outsideDir = path.join(tempDir, 'outside');
  await fs.mkdir(projectRoot, { recursive: true });
  await fs.mkdir(outsideDir, { recursive: true });
  await fs.writeFile(path.join(outsideDir, 'secret.txt'), 'top-secret');

  const escapeLink = path.join(projectRoot, 'escape-link');
  await fs.symlink(outsideDir, escapeLink, process.platform === 'win32' ? 'junction' : 'dir');

  // Existing symlink escape target must be rejected
  await assert.rejects(() => safeJoin(projectRoot, 'escape-link', 'secret.txt'), /Security Error/);

  // Non-existent file through a symlink pointing outside must also be rejected
  await assert.rejects(() => safeJoin(projectRoot, 'escape-link', 'new-file.txt'), /Security Error/);

  // Dangling symlink escape must be rejected
  const danglingLink = path.join(projectRoot, 'dangling-link');
  await fs.symlink(path.join(outsideDir, 'missing-dir'), danglingLink);
  await assert.rejects(() => safeJoin(projectRoot, 'dangling-link', 'payload.txt'), /Security Error/);

  // Valid filename starting with '..' inside project must NOT trigger false positive
  const dotDotFile = await safeJoin(projectRoot, '..notes.md');
  assert.ok(dotDotFile.endsWith('..notes.md'));
  assert.equal(await isPathInside(projectRoot, await fs.realpath(projectRoot)), true);

  // Null byte must be rejected
  await assert.rejects(() => safeJoin(projectRoot, 'notes.md\0.txt'), /Security Error/);
});

test('OutputParserService.applyChanges blocks .metadata, .git, .env, dotfiles, and symlink escapes', async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sec-apply-'));
  t.after(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const projectRoot = path.join(tempDir, 'project');
  const outsideDir = path.join(tempDir, 'outside');
  await fs.mkdir(projectRoot, { recursive: true });
  await fs.mkdir(outsideDir, { recursive: true });
  await fs.symlink(outsideDir, path.join(projectRoot, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');

  await OutputParserService.applyChanges(projectRoot, [
    { path: '.metadata/project.json', content: 'pwned' },
    { path: '.git/config', content: 'pwned' },
    { path: '.env', content: 'SECRET=1' },
    { path: '.gitignore', content: 'pwned' },
    { path: 'escape/pwn.txt', content: 'pwned' },
    { path: 'docs/valid.md', content: 'hello' },
  ]);

  assert.equal(await fs.access(path.join(projectRoot, '.metadata', 'project.json')).then(() => true).catch(() => false), false);
  assert.equal(await fs.access(path.join(projectRoot, '.env')).then(() => true).catch(() => false), false);
  assert.equal(await fs.access(path.join(outsideDir, 'pwn.txt')).then(() => true).catch(() => false), false);
  assert.equal(await fs.readFile(path.join(projectRoot, 'docs', 'valid.md'), 'utf8'), 'hello');
});

test('safeJsonParse and jsonUtils.extractAndParseJson strip prototype pollution keys and enforce size caps', () => {
  const payload = '{"__proto__": {"polluted": true}, "constructor": {"x": 1}, "prototype": {"y": 2}, "ok": 42}';
  const parsedBackend = safeJsonParse(payload);
  assert.equal(Object.prototype.hasOwnProperty.call(parsedBackend, '__proto__'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(parsedBackend, 'constructor'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(parsedBackend, 'prototype'), false);
  assert.equal(({}).polluted, undefined);
  assert.equal(parsedBackend.ok, 42);

  const parsedFrontend = extractAndParseJson(payload);
  assert.equal(Object.prototype.hasOwnProperty.call(parsedFrontend, '__proto__'), false);
  assert.equal(({}).polluted, undefined);
  assert.equal(parsedFrontend.ok, 42);

  assert.throws(() => safeJsonParse('{"a":1}', { maxBytes: 3 }), { statusCode: 413 });
});

test('http utilities validate Host/Origin/Sec-Fetch-Site, prevent wildcard CORS, and enforce readJson caps', async () => {
  const makeRes = () => {
    const headersOut = {};
    return {
      headersSent: false,
      writableEnded: false,
      statusCode: 0,
      body: '',
      _headers: headersOut,
      writeHead(code, hdrs) {
        this.statusCode = code;
        Object.assign(this._headers, hdrs || {});
      },
      end(data = '') {
        this.writableEnded = true;
        this.body = data;
      },
    };
  };

  // Loopback cross-port (localhost <-> 127.0.0.1 with sec-fetch-site: cross-site) is allowed and echoes specific Origin
  const okRes = makeRes();
  const okAllowed = validateLocalRequest(
    {
      headers: {
        host: '127.0.0.1:51423',
        origin: 'http://localhost:5173',
        'sec-fetch-site': 'cross-site',
      },
    },
    okRes
  );
  assert.equal(okAllowed, true);
  const okHdrs = getSecurityHeaders(okRes);
  assert.equal(okHdrs['Access-Control-Allow-Origin'], 'http://localhost:5173');
  assert.notEqual(okHdrs['Access-Control-Allow-Origin'], '*');
  assert.equal(okHdrs['Cross-Origin-Resource-Policy'], 'cross-origin');
  assert.equal(okHdrs['X-Content-Type-Options'], 'nosniff');

  // Without validated origin, CORP stays same-site
  const sameOriginRes = makeRes();
  assert.equal(validateLocalRequest({ headers: { host: '127.0.0.1:51423' } }, sameOriginRes), true);
  assert.equal(getSecurityHeaders(sameOriginRes)['Cross-Origin-Resource-Policy'], 'same-site');

  // Foreign Origin is rejected with 403
  const evilRes = makeRes();
  assert.equal(
    validateLocalRequest({ headers: { host: '127.0.0.1:51423', origin: 'https://evil.com' } }, evilRes),
    false
  );
  assert.equal(evilRes.statusCode, 403);

  // Missing Origin + sec-fetch-site: cross-site is rejected with 403
  const sfsRes = makeRes();
  assert.equal(
    validateLocalRequest({ headers: { host: '127.0.0.1:51423', 'sec-fetch-site': 'cross-site' } }, sfsRes),
    false
  );
  assert.equal(sfsRes.statusCode, 403);

  // Oversized body returns 413 and malformed JSON returns 400
  await assert.rejects(() => readJson(Readable.from(['{"a":"' + 'x'.repeat(200) + '"}']), { maxBytes: 50 }), {
    statusCode: 413,
  });
  await assert.rejects(() => readJson(Readable.from(['{not-json'])), {
    statusCode: 400,
  });
});

test('zip-utils enforces traversal, __proto__, CRC-32, entry count, and uncompressed size/ratio limits', () => {
  const validZip = packZip({ 'ppt/presentation.xml': '<p:presentation/>' });
  const unpacked = unpackZip(validZip);
  assert.equal(unpacked['ppt/presentation.xml'].toString('utf8'), '<p:presentation/>');
  assert.equal(Object.getPrototypeOf(unpacked), null);

  // Traversal entry rejected
  const traversalZip = packZip({ '../evil.txt': 'bad' });
  assert.throws(() => unpackZip(traversalZip), /Unsafe ZIP entry path/);

  // __proto__ entry rejected
  const protoZip = packZip({ '__proto__/x.txt': 'bad' });
  assert.throws(() => unpackZip(protoZip), /Unsafe ZIP entry path/);

  // CRC-32 tampering rejected
  const tampered = Buffer.from(validZip);
  tampered[14] ^= 0xff; // Flip first byte of CRC-32 in local file header
  assert.throws(() => unpackZip(tampered), /CRC-32 mismatch/);

  // Oversized entry / ratio limit rejected
  const compressible = Buffer.alloc(100_000, 0x41);
  const ratioZip = packZip({ 'big.txt': compressible });
  assert.throws(() => unpackZip(ratioZip, { maxEntryBytes: 50_000 }), /exceeding limit|exceeds.*size limit/i);
  assert.throws(() => unpackZip(ratioZip, { maxCompressionRatio: 5 }), /compression ratio/i);

  // Entry count limit rejected
  assert.throws(() => unpackZip(validZip, { maxEntries: 0 }), /maximum entry count/i);
});

test('skills helpers prevent regex/$& injection and shell/flag injection in import commands', () => {
  const rendered = renderSkill({ prompt_template: 'Hello {{user.name}}!' }, { 'user.name': '$&$1`id`' });
  assert.equal(rendered, 'Hello $&$1`id`!');

  assert.deepEqual(
    parseSkillsImportArgs('npx skills add owner/repo --skill my-skill'),
    ['--yes', 'skills', 'add', 'owner/repo', '--skill', 'my-skill', '--yes', '--agent', 'openclaw', '--copy']
  );

  assert.deepEqual(
    parseSkillsImportArgs('npx --yes skills add owner/repo --skill my-skill --yes'),
    ['--yes', 'skills', 'add', 'owner/repo', '--skill', 'my-skill', '--yes', '--agent', 'openclaw', '--copy']
  );

  assert.throws(() => parseSkillsImportArgs('npx skills add owner/repo; rm -rf /'), { statusCode: 400 });
  assert.throws(() => parseSkillsImportArgs('npx skills add owner/repo --package=evil'), { statusCode: 400 });
  assert.throws(() => parseSkillsImportArgs('bash -c id'), { statusCode: 400 });
});

test('privacy-filter redacts full PEM private key blocks and avoids ReDoS in matchGlob', () => {
  const sampleKey = [
    'Here is a key:',
    '-----BEGIN EC PRIVATE KEY-----',
    'MHcCAQEEIMOCKSECRETKEYDATA1234567890ABCDEF',
    'oAoGCCqGSM49AwEHoUQDQgAE1234567890',
    '-----END EC PRIVATE KEY-----',
    'Done.',
  ].join('\n');

  const scan = scanForSecrets(sampleKey);
  assert.equal(scan.isSafe, false);
  const { redacted } = redactSecrets(sampleKey);
  assert.equal(redacted.includes('MOCKSECRETKEYDATA'), false);

  const started = Date.now();
  const matched = matchGlob('a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/file.md', 'a/**/**/**/**/**/**/**/**/file.md');
  const elapsedMs = Date.now() - started;
  assert.equal(matched, true);
  assert.ok(elapsedMs < 200, `matchGlob took unexpectedly long (${elapsedMs}ms)`);
  assert.equal(matchGlob('a/b/c/d/e/f/g/h/i/j/k/l/m/n/file.md', 'a/**/**/**/**/**/nope.md'), false);
});

test('projectLinks safely handles malformed URIs, dangerous schemes, peek:// and dot-dot paths', () => {
  assert.deepEqual(resolveProjectLink('javascript:alert(1)'), { type: 'ignore' });
  assert.deepEqual(resolveProjectLink('  java\tscript:alert(1)'), { type: 'ignore' });
  assert.deepEqual(resolveProjectLink('data:text/html,<script>alert(1)</script>'), { type: 'ignore' });
  assert.deepEqual(resolveProjectLink('broken/%E0%A4%A.md'), { type: 'ignore' });
  assert.deepEqual(resolveProjectLink('peek://../../etc/passwd'), { type: 'peek', fileName: 'etc/passwd' });
  assert.equal(normalizeRelativePath('docs', '../../outside.md'), 'outside.md');
});
