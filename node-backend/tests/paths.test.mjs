import { test } from 'node:test';
import assert from 'node:assert';
import { getSidecarPath } from '../lib/paths.mjs';

test('getSidecarPath - normalizes and converts .md extension to .json', () => {
  assert.strictEqual(getSidecarPath('foo/bar.md'), 'foo/bar.json');
  assert.strictEqual(getSidecarPath('my-feature.md'), 'my-feature.json');
});

test('getSidecarPath - handles extensionless paths and .json files', () => {
  assert.strictEqual(getSidecarPath('foo/bar'), 'foo/bar.json');
  assert.strictEqual(getSidecarPath('document'), 'document.json');
  assert.strictEqual(getSidecarPath('foo/bar.json'), 'foo/bar.json');
});

test('getSidecarPath - throws on non-.md/non-json extensions', () => {
  assert.throws(() => getSidecarPath('foo/bar.txt'), /only supports .md/);
  assert.throws(() => getSidecarPath('document.doc'), /only supports .md/);
});

test('getSidecarPath - normalizes Windows backslashes to POSIX forward slashes', () => {
  assert.strictEqual(getSidecarPath('foo\\bar.md'), 'foo/bar.json');
  assert.strictEqual(getSidecarPath('foo\\bar\\baz'), 'foo/bar/baz.json');
});

test('getSidecarPath - throws on invalid inputs', () => {
  assert.throws(() => getSidecarPath(null), /Invalid path/);
  assert.throws(() => getSidecarPath(undefined), /Invalid path/);
  assert.throws(() => getSidecarPath(''), /Invalid path/);
  assert.throws(() => getSidecarPath('   '), /Invalid path/);
});
