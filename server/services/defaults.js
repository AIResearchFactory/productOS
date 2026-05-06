import fs from 'fs';
import path from 'path';
import os from 'os';
import { getAppDataDir } from './paths.js';

/**
 * Port of Rust DefaultsService.
 */

export async function getRecommendedDefaults() {
  let defaults = { openai: 'gpt-4o', gemini: 'gemini-2.0-flash' };

  // 1. Try local override
  const localOverride = getLocalOverride();
  if (localOverride) return localOverride;

  // 2. Try remote fetch
  try {
    const resp = await fetch('https://models.dev/api.json');
    if (resp.ok) {
      const data = await resp.json();
      const oaiBest = findLatestModel(data, 'openai', ['gpt-4o', 'gpt-4-turbo', 'gpt-4']);
      if (oaiBest) defaults.openai = oaiBest;
      const gemBest = findLatestModel(data, 'google', ['gemini-1.5', 'gemini-1.0']);
      if (gemBest) defaults.gemini = gemBest;
      saveToCache(defaults);
    }
  } catch (e) {
    console.warn(`[defaults] Failed to fetch remote defaults: ${e.message}`);
    const cached = loadFromCache();
    if (cached) return cached;
  }

  return defaults;
}

function findLatestModel(data, providerId, families) {
  const provider = data[providerId];
  if (!provider || !provider.models) return null;

  let bestId = null, bestDate = '0000-00-00';
  for (const [id, info] of Object.entries(provider.models)) {
    const isTarget = families.some(f =>
      (info.id || '').includes(f) || (info.family || '').includes(f)
    );
    if (isTarget) {
      const date = info.release_date || '0000-00-00';
      if (date > bestDate) { bestDate = date; bestId = id; }
    }
  }
  return bestId;
}

function getLocalOverride() {
  try {
    const p = path.join(os.homedir(), '.config', 'productos', 'defaults.json');
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch { /* ignore */ }
  return null;
}

function loadFromCache() {
  try {
    const p = path.join(getAppDataDir(), 'defaults_cache.json');
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch { /* ignore */ }
  return null;
}

function saveToCache(defaults) {
  try {
    const p = path.join(getAppDataDir(), 'defaults_cache.json');
    fs.writeFileSync(p, JSON.stringify(defaults, null, 2), 'utf-8');
  } catch { /* ignore */ }
}
