import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanJsonContent, repairJson, extractAndParseJson } from '../../src/lib/jsonUtils.js';

test('cleanJsonContent - handles standard JSON', () => {
  const input = '{"projectId": "p1", "fileName": "f.txt"}';
  const parsed = JSON.parse(cleanJsonContent(input));
  assert.equal(parsed.projectId, 'p1');
});

test('cleanJsonContent - handles markdown code blocks', () => {
  const input = '```json\n{\n  "projectId": "p1",\n  "fileName": "f.txt"\n}\n```';
  const parsed = JSON.parse(cleanJsonContent(input));
  assert.equal(parsed.projectId, 'p1');
});

test('cleanJsonContent - handles text before and after JSON', () => {
  const input = 'Here is the fix:\n```json\n{\n  "projectId": "p1",\n  "fileName": "f.txt"\n}\n```\nHope this helps!';
  const parsed = JSON.parse(cleanJsonContent(input));
  assert.equal(parsed.projectId, 'p1');
  assert.equal(parsed.fileName, 'f.txt');
});

test('cleanJsonContent - handles unescaped multiline strings in JSON', () => {
  const input = `{\n  "projectId": "p1",\n  "original": "line 1\nline 2",\n  "replacement": "line 1 modified\nline 2"\n}`;
  const parsed = JSON.parse(cleanJsonContent(input));
  assert.equal(parsed.projectId, 'p1');
  assert.equal(parsed.original, 'line 1\nline 2');
});

test('cleanJsonContent - handles trailing commas', () => {
  const input = '{\n  "projectId": "p1",\n  "commentIds": ["c1", "c2", ],\n}';
  const parsed = JSON.parse(cleanJsonContent(input));
  assert.equal(parsed.projectId, 'p1');
  assert.deepEqual(parsed.commentIds, ['c1', 'c2']);
});

test('cleanJsonContent - handles trailing text after JSON without code blocks', () => {
  const input = '{\n  "projectId": "p1",\n  "fileName": "test.js"\n}\n\nI have resolved the comment as requested.';
  const parsed = JSON.parse(cleanJsonContent(input));
  assert.equal(parsed.projectId, 'p1');
  assert.equal(parsed.fileName, 'test.js');
});

test('cleanJsonContent - handles incomplete stream prefix', () => {
  const input = '{\n  "projectId"';
  const cleaned = cleanJsonContent(input);
  assert.ok(typeof cleaned === 'string');
});

test('extractAndParseJson - returns parsed object directly', () => {
  const input = '```json\n{"success": true, "count": 42}\n```';
  const result = extractAndParseJson(input);
  assert.deepEqual(result, { success: true, count: 42 });
});

test('extractAndParseJson - returns fallback on invalid input if provided', () => {
  const input = 'Not valid json at all';
  const fallback = { fallback: true };
  const result = extractAndParseJson(input, fallback);
  assert.deepEqual(result, fallback);
});
