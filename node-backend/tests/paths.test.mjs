import { test } from 'node:test';
import assert from 'node:assert';
import { getSidecarPath } from '../lib/paths.mjs';

test('getSidecarPath - normalizes and converts .md extension to .json', () => {
  assert.strictEqual(getSidecarPath('foo/bar.md'), 'foo/bar.json');
  assert.strictEqual(getSidecarPath('my-feature.md'), 'my-feature.json');
});

test('getSidecarPath - handles non-.md extensions by replacing them', () => {
  assert.strictEqual(getSidecarPath('foo/bar.txt'), 'foo/bar.json');
  assert.strictEqual(getSidecarPath('foo/bar'), 'foo/bar.json');
  assert.strictEqual(getSidecarPath('document.doc'), 'document.json');
});

test('getSidecarPath - normalizes Windows backslashes to POSIX forward slashes', () => {
  assert.strictEqual(getSidecarPath('foo\\bar.md'), 'foo/bar.json');
  assert.strictEqual(getSidecarPath('foo\\bar\\baz.txt'), 'foo/bar/baz.json');
});

test('getSidecarPath - throws on invalid inputs', () => {
  assert.throws(() => getSidecarPath(null), /Invalid path/);
  assert.throws(() => getSidecarPath(undefined), /Invalid path/);
  assert.throws(() => getSidecarPath(''), /Invalid path/);
  assert.throws(() => getSidecarPath('   '), /Invalid path/);
});
