import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRelativePath, resolveProjectLink } from '../../src/lib/projectLinks.js';

test('normalizeRelativePath - handles same directory and child directory', () => {
  assert.equal(normalizeRelativePath('roadmaps', './init-1.md'), 'roadmaps/init-1.md');
  assert.equal(normalizeRelativePath('roadmaps', 'init-1.md'), 'roadmaps/init-1.md');
  assert.equal(normalizeRelativePath('', './init-1.md'), 'init-1.md');
});

test('normalizeRelativePath - handles parent directory navigation', () => {
  assert.equal(normalizeRelativePath('roadmaps', '../initiatives/init-1.md'), 'initiatives/init-1.md');
  assert.equal(normalizeRelativePath('initiatives/sub', '../../roadmaps/roadmap.md'), 'roadmaps/roadmap.md');
});

test('resolveProjectLink - ignores empty or hash-only links', () => {
  assert.deepEqual(resolveProjectLink(''), { type: 'ignore' });
  assert.deepEqual(resolveProjectLink('#'), { type: 'ignore' });
  assert.deepEqual(resolveProjectLink(null), { type: 'ignore' });
});

test('resolveProjectLink - detects in-page anchor links', () => {
  const result = resolveProjectLink('#acceptance-criteria');
  assert.equal(result.type, 'anchor');
  assert.equal(result.hash, 'acceptance-criteria');
});

test('resolveProjectLink - detects external web URLs', () => {
  const result = resolveProjectLink('https://github.com/org/repo');
  assert.equal(result.type, 'external');
  assert.equal(result.url, 'https://github.com/org/repo');

  const mailto = resolveProjectLink('mailto:test@example.com');
  assert.equal(mailto.type, 'external');
  assert.equal(mailto.url, 'mailto:test@example.com');
});

test('resolveProjectLink - handles peek:// custom protocol', () => {
  const result = resolveProjectLink('peek://user-stories/us-1.md');
  assert.equal(result.type, 'peek');
  assert.equal(result.fileName, 'user-stories/us-1.md');
});

test('resolveProjectLink - handles project:// custom protocol', () => {
  const result = resolveProjectLink('project://roadmaps/roadmap.md');
  assert.equal(result.type, 'document');
  assert.equal(result.fileName, 'roadmaps/roadmap.md');
});

test('resolveProjectLink - resolves relative document paths with currentFilePath', () => {
  const result = resolveProjectLink('../initiatives/init-1.md', 'roadmaps/roadmap.md');
  assert.equal(result.type, 'document');
  assert.equal(result.fileName, 'initiatives/init-1.md');
});

test('resolveProjectLink - preserves anchor hash on document links', () => {
  const result = resolveProjectLink('./story.md#section-2', 'user-stories/index.md');
  assert.equal(result.type, 'document');
  assert.equal(result.fileName, 'user-stories/story.md');
  assert.equal(result.hash, 'section-2');
});

test('resolveProjectLink - auto-appends .md if missing', () => {
  const result = resolveProjectLink('initiatives/init-1', '');
  assert.equal(result.type, 'document');
  assert.equal(result.fileName, 'initiatives/init-1.md');
});

test('resolveProjectLink - fuzzy matches knownFiles by basename', () => {
  const knownFiles = ['user-stories/us-login.md', 'roadmaps/roadmap.md', 'initiatives/init-auth.md'];
  const result = resolveProjectLink('us-login.md', 'roadmaps/roadmap.md', knownFiles);
  assert.equal(result.type, 'document');
  assert.equal(result.fileName, 'user-stories/us-login.md');
});

test('resolveProjectLink - handles root slash paths', () => {
  const result = resolveProjectLink('/initiatives/init-1.md', 'roadmaps/sub/item.md');
  assert.equal(result.type, 'document');
  assert.equal(result.fileName, 'initiatives/init-1.md');
});
