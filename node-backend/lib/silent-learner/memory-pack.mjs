/**
 * memory-pack.mjs
 * Distills learning events into compact, reusable memory packs (JSONL files).
 * Memory packs are the primary learning output — retrieved at runtime and
 * injected into prompts for improved AI responses.
 *
 * Pack types:
 *   - workspace-style: Code style, naming conventions, architecture patterns
 *   - testing-patterns: Test strategies, assertion styles, fixture patterns
 *   - tool-recipes: Tool usage patterns, CLI commands, workflow steps
 *   - accepted-solutions: Successful solutions for specific problem types
 *   - rejected-patterns: Anti-patterns learned from corrections/reverts
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { getProjectById } from '../projects.mjs';
import { safeJoin } from '../paths.mjs';
import { getEvents, upsertMemoryPack, listMemoryPacks as listPacksFromDb } from './learning-store.mjs';

/**
 * Pack type definitions with classification rules.
 */
const PACK_TYPES = {
  'workspace-style': {
    name: 'Workspace Style',
    description: 'Code style, naming conventions, and architecture patterns',
    filter: (event) => {
      const types = ['feature', 'refactor', 'generation', 'prd', 'roadmap', 'user_story', 'kpi', 'launch', 'feedback', 'competitive', 'comment_fix', 'documentation', 'presentation'];
      return types.includes(event.task_type) && event.accepted_changes;
    },
  },
  'testing-patterns': {
    name: 'Testing Patterns',
    description: 'Test strategies, assertion styles, and fixture patterns',
    filter: (event) => {
      return event.task_type === 'testing' ||
        (event.files_touched || []).some(f => /\.(?:test|spec)\./i.test(f));
    },
  },
  'tool-recipes': {
    name: 'Tool Recipes',
    description: 'Successful multi-step tool usage patterns',
    filter: (event) => {
      return event.metadata?.fileChangeCount > 0 || 
        event.metadata?.artifactChangeCount > 0 ||
        (event.files_touched && event.files_touched.length > 0);
    },
  },
  'accepted-solutions': {
    name: 'Accepted Solutions',
    description: 'Successful solutions for specific problem types',
    filter: (event) => {
      const outcomes = ['files_changed', 'artifacts_changed', 'files_and_artifacts_changed', 'response_generated'];
      return outcomes.includes(event.outcome) && event.accepted_changes;
    },
  },
  'rejected-patterns': {
    name: 'Rejected Patterns',
    description: 'Anti-patterns from corrections and reverts',
    filter: (event) => {
      return event.outcome === 'error' || event.outcome === 'aborted';
    },
  },
};

/**
 * Get the memory-packs directory for a project.
 * @param {string} projectId
 * @returns {Promise<string>}
 */
async function getPacksDir(projectId) {
  const project = await getProjectById(projectId);
  const dir = await safeJoin(project.path, '.metadata', 'memory-packs');
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Build a single JSONL line from a learning event.
 * This is the distilled representation — compact and reusable.
 *
 * @param {object} event - Learning event from the store
 * @param {string} packType - Which pack this lesson belongs to
 * @returns {object} JSONL-ready object
 */
function distillEvent(event, packType) {
  const lesson = {
    id: event.id,
    type: packType,
    task: event.task_type || 'general',
    source: event.source,
    outcome: event.outcome,
    files: event.files_touched || [],
    timestamp: event.created_at,
  };

  // Add pack-specific fields
  switch (packType) {
    case 'accepted-solutions': {
      lesson.signal = 'accepted';
      let metaChangeCount = (event.metadata?.fileChangeCount || 0) + (event.metadata?.artifactChangeCount || 0);
      if (metaChangeCount === 0 && event.files_touched?.length > 0) {
        metaChangeCount = event.files_touched.length;
      }
      lesson.changeCount = metaChangeCount;
      break;
    }
    case 'rejected-patterns': {
      lesson.signal = 'rejected';
      lesson.reason = event.outcome;
      break;
    }
    case 'tool-recipes': {
      let filesChanged = event.metadata?.fileChangeCount || 0;
      let artifactsChanged = event.metadata?.artifactChangeCount || 0;
      
      // Fallback for cold-start or legacy events where count is missing/zero but files were touched
      if (filesChanged === 0 && artifactsChanged === 0 && event.files_touched?.length > 0) {
        const artifactDirs = ['roadmaps', 'prds', 'initiatives', 'user-stories', 'one-pagers', 'pr-faqs', 'competitive-research', 'presentations', 'insights', 'product-visions'];
        for (const ref of event.files_touched) {
          const firstDir = ref.split('/')[0];
          if (artifactDirs.includes(firstDir)) {
            artifactsChanged++;
          } else {
            filesChanged++;
          }
        }
      }

      lesson.steps = {
        filesChanged,
        artifactsChanged,
        provider: event.source,
        model: event.metadata?.model || null,
      };
      break;
    }
    case 'workspace-style': {
      lesson.patterns = {
        fileTypes: [...new Set((event.files_touched || []).map(f => path.extname(f)).filter(Boolean))],
        taskCategory: event.task_type,
      };
      break;
    }
    case 'testing-patterns': {
      lesson.testFiles = (event.files_touched || []).filter(f => /\.(?:test|spec)\./i.test(f));
      break;
    }
  }

  return lesson;
}

/**
 * Build or update memory packs from the learning event store.
 * This is the main distillation entry point.
 *
 * @param {string} projectId
 * @param {object} [options]
 * @param {function} [options.onProgress] - Progress callback (packType, count)
 * @returns {Promise<{ packsBuilt: number, totalLessons: number }>}
 */
export async function buildMemoryPacks(projectId, options = {}) {
  const { onProgress } = options;
  const packsDir = await getPacksDir(projectId);

  // Get all safe, qualifying events
  const events = await getEvents(projectId, { data_class: 'safe' });

  if (events.length === 0) {
    return { packsBuilt: 0, totalLessons: 0 };
  }

  let packsBuilt = 0;
  let totalLessons = 0;

  for (const [packType, packDef] of Object.entries(PACK_TYPES)) {
    // Filter events matching this pack type
    const matching = events.filter(packDef.filter);
    if (matching.length === 0) continue;

    // Distill each event into a lesson
    const lessons = matching.map(e => distillEvent(e, packType));
    totalLessons += lessons.length;

    // Write JSONL file
    const filePath = path.join(packsDir, `${packType}.jsonl`);
    const jsonlContent = lessons.map(l => JSON.stringify(l)).join('\n') + '\n';
    await fs.writeFile(filePath, jsonlContent, 'utf8');

    // Update database record
    await upsertMemoryPack(projectId, {
      id: packType,
      name: packDef.name,
      pack_type: packType,
      file_path: `.metadata/memory-packs/${packType}.jsonl`,
      relevance_score: computePackRelevance(matching),
      event_count: lessons.length,
    });

    packsBuilt++;
    if (onProgress) onProgress(packType, lessons.length);
  }

  return { packsBuilt, totalLessons };
}

/**
 * Compute a relevance score for a memory pack based on its events.
 * Higher score = more recent + more accepted changes.
 *
 * @param {object[]} events
 * @returns {number}
 */
function computePackRelevance(events) {
  if (events.length === 0) return 0;

  const now = Date.now();
  let score = 0;

  for (const event of events) {
    // Recency bonus
    const age = (now - new Date(event.created_at).getTime()) / (1000 * 60 * 60 * 24);
    const recency = Math.exp(-0.05 * age);

    // Acceptance bonus
    const acceptance = event.accepted_changes ? 0.3 : 0;

    score += recency + acceptance;
  }

  // Normalize to 0-1 range
  return Math.min(1.0, score / events.length);
}

/**
 * Read a memory pack JSONL file and return parsed lessons.
 *
 * @param {string} projectId
 * @param {string} packType
 * @returns {Promise<object[]>}
 */
export async function readMemoryPack(projectId, packType) {
  const packsDir = await getPacksDir(projectId);
  const filePath = path.join(packsDir, `${packType}.jsonl`);

  try {
    const content = await fs.readFile(filePath, 'utf8');
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try { return JSON.parse(line); }
        catch { return null; }
      })
      .filter(Boolean);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

/**
 * List all available memory packs with their metadata.
 *
 * @param {string} projectId
 * @returns {Promise<Array<{ name: string, packType: string, eventCount: number, relevanceScore: number }>>}
 */
export async function listMemoryPacks(projectId) {
  return listPacksFromDb(projectId);
}

/**
 * Delete all memory pack files for a project.
 *
 * @param {string} projectId
 * @returns {Promise<void>}
 */
export async function deleteMemoryPacks(projectId) {
  const project = await getProjectById(projectId);
  const packsDir = await safeJoin(project.path, '.metadata', 'memory-packs');
  await fs.rm(packsDir, { recursive: true, force: true });
}

/**
 * Export all memory packs as a single JSON object.
 * Used for the "Export Memory Pack" user action.
 *
 * @param {string} projectId
 * @returns {Promise<object>}
 */
export async function exportAllPacks(projectId) {
  const packs = await listPacksFromDb(projectId);
  const result = {
    projectId,
    exportedAt: new Date().toISOString(),
    packs: {},
  };

  for (const pack of packs) {
    const lessons = await readMemoryPack(projectId, pack.pack_type);
    result.packs[pack.pack_type] = {
      name: pack.name,
      eventCount: pack.event_count,
      relevanceScore: pack.relevance_score,
      lessons,
    };
  }

  return result;
}
