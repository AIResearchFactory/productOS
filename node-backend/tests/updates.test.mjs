import test from 'node:test';
import assert from 'node:assert/strict';
import { checkVersionUpdate } from '../lib/updates.mjs';

test('checkVersionUpdate - detects new version from npm', async () => {
  const mockFetch = async (url) => {
    if (url.includes('registry.npmjs.org')) {
      return {
        ok: true,
        json: async () => ({ version: '0.4.6', description: 'Bug fixes and performance improvements' }),
      };
    }
    return { ok: false };
  };

  const result = await checkVersionUpdate('0.4.5', { fetchFn: mockFetch });
  assert.equal(result.available, true);
  assert.equal(result.currentVersion, '0.4.5');
  assert.equal(result.latestVersion, '0.4.6');
  assert.equal(result.source, 'npm');
  assert.equal(result.updateCommand, 'npm install -g productos@latest');
});

test('checkVersionUpdate - detects already up to date from npm', async () => {
  const mockFetch = async (url) => {
    if (url.includes('registry.npmjs.org')) {
      return {
        ok: true,
        json: async () => ({ version: '0.4.5' }),
      };
    }
    return { ok: false };
  };

  const result = await checkVersionUpdate('0.4.5', { fetchFn: mockFetch });
  assert.equal(result.available, false);
  assert.equal(result.currentVersion, '0.4.5');
  assert.equal(result.latestVersion, '0.4.5');
});

test('checkVersionUpdate - falls back to GitHub releases when npm fails', async () => {
  const mockFetch = async (url) => {
    if (url.includes('registry.npmjs.org')) {
      throw new Error('NPM registry unreachable');
    }
    if (url.includes('api.github.com')) {
      return {
        ok: true,
        json: async () => ({
          tag_name: 'v0.5.0',
          body: 'Exciting new features',
          html_url: 'https://github.com/AIResearchFactory/productOS/releases/tag/v0.5.0'
        }),
      };
    }
    return { ok: false };
  };

  const result = await checkVersionUpdate('0.4.5', { fetchFn: mockFetch });
  assert.equal(result.available, true);
  assert.equal(result.currentVersion, '0.4.5');
  assert.equal(result.latestVersion, '0.5.0');
  assert.equal(result.source, 'github');
  assert.equal(result.releaseNotes, 'Exciting new features');
});

test('checkVersionUpdate - handles complete offline failure gracefully', async () => {
  const mockFetch = async () => {
    throw new Error('Network offline');
  };

  const result = await checkVersionUpdate('0.4.5', { fetchFn: mockFetch });
  assert.equal(result.available, false);
  assert.equal(result.currentVersion, '0.4.5');
  assert.equal(result.latestVersion, '0.4.5');
  assert.equal(result.source, 'offline');
});
