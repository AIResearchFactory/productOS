/**
 * enrichment.mjs
 * Three-stage progressive sidecar enrichment pipeline for Silent Learner.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { getProjectById } from '../projects.mjs';
import { safeJoin } from '../paths.mjs';
import { classifyFileType } from './content-classifier.mjs';

function getSidecarPath(artifactPath) {
  if (artifactPath.endsWith('.md')) {
    return artifactPath.replace(/\.md$/, '.json');
  }
  const parsed = path.parse(artifactPath);
  const name = parsed.name || parsed.base;
  return path.join(parsed.dir, name + '.json');
}
import { extractEntitiesHeuristic, extractEntitiesAI } from './entity-extractor.mjs';
import { EncryptionService } from '../encryption.mjs';
import { AIService } from '../ai.mjs';
import { getGlobalSettingsPath, getSecretsPath } from '../paths.mjs';

// Background queue state
const enrichmentQueue = [];
let queueProcessing = false;
let currentQueuePromise = null;

// Read settings
async function readGlobalSettings() {
  const settingsPath = await getGlobalSettingsPath();
  try {
    return JSON.parse(await fs.readFile(settingsPath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

// Read and decrypt secrets
async function readSecrets() {
  const secretsPath = await getSecretsPath();
  try {
    const encryptedData = await fs.readFile(secretsPath, 'utf8');
    const decryptedData = EncryptionService.decrypt(encryptedData);
    return JSON.parse(decryptedData);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {};
    }
    if (process.env.NODE_ENV === 'test' || process.env.ALLOW_UNENCRYPTED_SECRETS_FOR_TESTS === 'true') {
      try {
        const raw = await fs.readFile(secretsPath, 'utf8');
        const data = JSON.parse(raw);
        return data;
      } catch {
        return {};
      }
    }
    console.error('[Enrichment] Decryption failed for secrets in production:', error.message);
    return {};
  }
}

// Get active AI provider
export async function getActiveProvider() {
  try {
    const settings = await readGlobalSettings();
    const secrets = await readSecrets().catch(() => ({}));
    const providerType = settings.activeProvider || settings.active_provider;
    if (!providerType || providerType === 'none') {
      return null;
    }
    return await AIService.createProvider(providerType, settings, secrets);
  } catch (err) {
    console.warn('[Enrichment] Failed to create active AI provider:', err.message);
    return null;
  }
}

/**
 * Helper to compute SHA-256 hash of a string.
 */
function computeSHA256(text) {
  return crypto.createHash('sha256').update(text || '').digest('hex');
}

/**
 * Stage 1: Immediate enrichment (synchronous, runs at import/creation time).
 * Computes hash, classifies file type, extracts title, writes minimal sidecar.
 * 
 * @param {string} projectId
 * @param {string} filePath - Path relative to project root
 */
export async function enrichImmediate(projectId, filePath) {
  const project = await getProjectById(projectId);
  const fullFilePath = await safeJoin(project.path, filePath);
  
  let content = '';
  try {
    content = await fs.readFile(fullFilePath, 'utf8');
  } catch (err) {
    console.error(`[Enrichment] Failed to read source file ${filePath}:`, err.message);
    throw err;
  }

  const contentHash = computeSHA256(content);
  const artifactType = classifyFileType(filePath, content);
  
  // Extract title (first H1 for .md, filename stem otherwise)
  let title = '';
  if (filePath.endsWith('.md')) {
    const titleLine = content.split('\n').find(l => l.startsWith('# '));
    if (titleLine) {
      title = titleLine.replace('# ', '').trim();
    }
  }
  if (!title) {
    const stem = path.parse(filePath).name;
    title = stem.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  const now = new Date().toISOString();
  const sidecarPath = await safeJoin(project.path, getSidecarPath(filePath));
  
  // Load existing sidecar if present to merge details
  let existing = {};
  try {
    existing = JSON.parse(await fs.readFile(sidecarPath, 'utf8'));
  } catch {}

  const sidecar = {
    id: existing.id || filePath,
    artifactType: existing.artifactType || artifactType,
    title: existing.title || title,
    description: existing.description !== undefined ? existing.description : null,
    tags: existing.tags || [],
    resource: existing.resource || filePath,
    sourceRefs: existing.sourceRefs || [],
    citations: existing.citations || [],
    projectId: projectId,
    created: existing.created || now,
    updated: now,
    metadata: existing.metadata || {},
    silentLearner: {
      confidence: existing.silentLearner?.confidence ?? 0.5,
      usageConsistency: existing.silentLearner?.usageConsistency ?? 0.0,
      recencyScore: existing.silentLearner?.recencyScore ?? 0.0,
      taskAlignment: existing.silentLearner?.taskAlignment ?? 0.0,
      compositeScore: existing.silentLearner?.compositeScore ?? 0.5,
      lastObserved: existing.silentLearner?.lastObserved ?? null,
      relatedConcepts: existing.silentLearner?.relatedConcepts || [],
      contentHash,
      enrichmentLevel: 'minimal',
      enrichedAt: now
    }
  };

  await fs.mkdir(path.dirname(sidecarPath), { recursive: true });
  await fs.writeFile(sidecarPath, JSON.stringify(sidecar, null, 2), 'utf8');
  return sidecar;
}

/**
 * Stage 2: Background deep enrichment (asynchronous, runs via queue).
 * Generates description, tags, and extracts entities.
 * 
 * @param {string} projectId
 * @param {string} filePath - Path relative to project root
 * @param {object} sidecar - Loaded sidecar object to enrich
 */
export async function enrichDeep(projectId, filePath, sidecar) {
  const project = await getProjectById(projectId);
  const fullFilePath = await safeJoin(project.path, filePath);
  
  let content = '';
  try {
    content = await fs.readFile(fullFilePath, 'utf8');
  } catch (err) {
    console.error(`[Enrichment] Failed to read source file ${filePath} for deep enrichment:`, err.message);
    throw err;
  }

  const provider = await getActiveProvider();
  let description = sidecar.description;
  let tags = sidecar.tags || [];
  let entities = [];

  if (provider) {
    try {
      const aiResult = await extractEntitiesAI(content, provider);
      description = aiResult.summary || description;
      tags = aiResult.tags.length > 0 ? aiResult.tags : tags;
      entities = aiResult.entities;
    } catch (err) {
      console.warn(`[Enrichment] AI deep extraction failed, using heuristic fallback:`, err.message);
    }
  }

  // Fallback if AI was unavailable or failed
  if (!provider || entities.length === 0) {
    const heuristicResult = extractEntitiesHeuristic(content);
    entities = heuristicResult.entities;
    
    // Fallback description: first paragraph, max 160 chars
    if (!description) {
      const paragraphs = content
        .split('\n')
        .map(p => p.trim())
        .filter(p => p && !p.startsWith('#') && !p.startsWith('```') && !p.startsWith('-') && !p.startsWith('*'));
      if (paragraphs.length > 0) {
        description = paragraphs[0];
        if (description.length > 160) {
          description = description.slice(0, 157) + '...';
        }
      }
    }

    // Fallback tags: use heading keywords
    if (tags.length === 0 && heuristicResult.keywords.length > 0) {
      tags = heuristicResult.keywords.slice(0, 5);
    }
  }

  const now = new Date().toISOString();
  sidecar.description = description;
  sidecar.tags = Array.from(new Set(tags));
  sidecar.updated = now;
  sidecar.silentLearner.relatedConcepts = Array.from(new Set(entities));
  sidecar.silentLearner.enrichmentLevel = 'full';
  sidecar.silentLearner.enrichedAt = now;

  const sidecarPath = await safeJoin(project.path, getSidecarPath(filePath));
  await fs.writeFile(sidecarPath, JSON.stringify(sidecar, null, 2), 'utf8');
  return sidecar;
}

const sidecarScanCache = new Map(); // projectId -> { paths: string[], expires: number }

async function getProjectSidecarPaths(projectId, projectPath) {
  const now = Date.now();
  const cached = sidecarScanCache.get(projectId);
  if (cached && cached.expires > now) {
    return cached.paths;
  }

  const scanSidecars = async (dir) => {
    const files = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    const results = [];
    for (const file of files) {
      if (file.isDirectory()) {
        if (file.name === '.git' || file.name === 'node_modules' || file.name === '.metadata') continue;
        results.push(...(await scanSidecars(path.join(dir, file.name))));
      } else if (file.name.endsWith('.json') && file.name !== 'package.json') {
        results.push(path.join(dir, file.name));
      }
    }
    return results;
  };

  const paths = await scanSidecars(projectPath);
  sidecarScanCache.set(projectId, { paths, expires: now + 5000 }); // cache for 5 seconds
  return paths;
}

/**
 * Stage 3: Relational enrichment.
 * Builds co-occurrence links, populates sourceRefs, computes compositeScore.
 * 
 * @param {string} projectId
 * @param {string} filePath - Path relative to project root
 * @param {object} sidecar - Loaded sidecar object to enrich
 */
export async function enrichRelational(projectId, filePath, sidecar) {
  const project = await getProjectById(projectId);
  const sidecarPath = await safeJoin(project.path, getSidecarPath(filePath));

  // Find all other sidecars in the project
  const sourceRefs = new Set(sidecar.sourceRefs || []);
  const currentConcepts = new Set((sidecar.silentLearner?.relatedConcepts || []).map(c => c.toLowerCase()));
  const currentTitle = (sidecar.title || '').toLowerCase();

  const allSidecarPaths = await getProjectSidecarPaths(projectId, project.path);
  const currentJsonPath = path.normalize(sidecarPath);

  for (const otherPath of allSidecarPaths) {
    if (path.normalize(otherPath) === currentJsonPath) continue;

    try {
      const otherSidecar = JSON.parse(await fs.readFile(otherPath, 'utf8'));
      if (!otherSidecar.resource || !otherSidecar.silentLearner) continue;

      let overlap = false;
      const otherConcepts = (otherSidecar.silentLearner.relatedConcepts || []).map(c => c.toLowerCase());
      const otherTitle = (otherSidecar.title || '').toLowerCase();

      // Check title overlap in concepts
      if (currentConcepts.has(otherTitle) || otherConcepts.includes(currentTitle)) {
        overlap = true;
      } else {
        // Check concept overlap
        for (const concept of currentConcepts) {
          if (otherConcepts.includes(concept)) {
            overlap = true;
            break;
          }
        }
      }

      if (overlap) {
        sourceRefs.add(otherSidecar.resource);
        
        // Bidirectional update if missing
        const otherRefs = new Set(otherSidecar.sourceRefs || []);
        if (!otherRefs.has(filePath)) {
          otherRefs.add(filePath);
          otherSidecar.sourceRefs = Array.from(otherRefs);
          await fs.writeFile(otherPath, JSON.stringify(otherSidecar, null, 2), 'utf8');
        }
      }
    } catch {}
  }

  sidecar.sourceRefs = Array.from(sourceRefs);

  // Compute composite score: simple average of scores
  const sl = sidecar.silentLearner || {};
  const confidence = sl.confidence ?? 0.5;
  const usageConsistency = sl.usageConsistency ?? 0.0;
  const recencyScore = sl.recencyScore ?? 0.0;
  const taskAlignment = sl.taskAlignment ?? 0.0;
  
  sl.compositeScore = Number(((confidence + usageConsistency + recencyScore + taskAlignment) / 4).toFixed(3));
  sidecar.silentLearner = sl;
  sidecar.updated = new Date().toISOString();

  await fs.writeFile(sidecarPath, JSON.stringify(sidecar, null, 2), 'utf8');
  return sidecar;
}

/**
 * Queues a file for background deep and relational enrichment.
 */
export function queueEnrichment(projectId, filePath) {
  if (enrichmentQueue.some(item => item.projectId === projectId && item.filePath === filePath)) {
    return; // Already queued
  }
  enrichmentQueue.push({ projectId, filePath });
  processQueue().catch(err => console.error('[EnrichmentQueue] Error processing queue:', err));
}

/**
 * Background queue processor. Concurrency limit = 3.
 */
async function processQueue() {
  if (queueProcessing) return currentQueuePromise;
  queueProcessing = true;

  currentQueuePromise = (async () => {
    while (enrichmentQueue.length > 0) {
      const batch = enrichmentQueue.splice(0, 3);
      await Promise.all(batch.map(async (item) => {
        try {
          const project = await getProjectById(item.projectId);
          const sidecarRelPath = getSidecarPath(item.filePath);
          const fullSidecarPath = await safeJoin(project.path, sidecarRelPath);

          let sidecar;
          try {
            sidecar = JSON.parse(await fs.readFile(fullSidecarPath, 'utf8'));
          } catch {
            // If sidecar does not exist, run immediate stage first
            sidecar = await enrichImmediate(item.projectId, item.filePath);
          }

          // Only run deep if not already deep/full
          if (sidecar.silentLearner?.enrichmentLevel !== 'full') {
            await enrichDeep(item.projectId, item.filePath, sidecar);
          }
          
          // Relational check
          await enrichRelational(item.projectId, item.filePath, sidecar);
        } catch (err) {
          console.error(`[EnrichmentQueue] Error enriching file ${item.filePath}:`, err.message);
        }
      }));
    }

    queueProcessing = false;
    currentQueuePromise = null;
  })();

  return currentQueuePromise;
}

export function clearEnrichmentQueue() {
  enrichmentQueue.length = 0;
}

export async function drainEnrichmentQueue() {
  while (queueProcessing && currentQueuePromise) {
    await currentQueuePromise;
  }
}
