/**
 * index.mjs
 * Silent Learner Service — main facade and state machine.
 *
 * State machine:
 *   Off → Observing → Distilling → Memory Ready → (Backup Synced) → (Adapter Ready)
 *
 * This module orchestrates all Silent Learner subsystems:
 *   - Learning Store (SQLite)
 *   - Privacy Filter (secret scanning)
 *   - Capture Hook (event building)
 *   - Scoring Engine (relevance scoring)
 *   - Memory Pack Builder (JSONL distillation)
 *   - Retrieval Layer (context assembly)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getProjectById } from '../projects.mjs';
import { safeJoin, getGlobalSettingsPath, getSidecarPath } from '../paths.mjs';

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
import * as Store from './learning-store.mjs';
import * as Privacy from './privacy-filter.mjs';
import * as Capture from './capture-hook.mjs';
import * as Scoring from './scoring.mjs';
import * as MemoryPack from './memory-pack.mjs';
import * as Retrieval from './retrieval.mjs';

/** Valid states for the Silent Learner state machine. */
const VALID_STATES = ['off', 'observing', 'distilling', 'memory_ready', 'paused'];

/**
 * Debounce timers for metadata back-propagation.
 * Key: projectId, Value: timeout handle
 * @type {Map<string, NodeJS.Timeout>}
 */
const debounceTimers = new Map();

/** Debounce delay for metadata writes (30 seconds per spec). */
const DEBOUNCE_MS = 30_000;

/** In-memory file usage cache for debounced writes. */
const usageCache = new Map();

// ─── State Machine ──────────────────────────────────────────────

/**
 * Get the current Silent Learner state for a project.
 * @param {string} projectId
 * @returns {Promise<string>}
 */
export async function getState(projectId) {
  try {
    const state = await Store.getState(projectId, 'mode');
    return state || 'off';
  } catch {
    return 'off';
  }
}

/**
 * Set the Silent Learner state for a project.
 * @param {string} projectId
 * @param {string} state
 * @returns {Promise<void>}
 */
async function setState(projectId, state) {
  if (!VALID_STATES.includes(state)) {
    throw new Error(`Invalid Silent Learner state: ${state}`);
  }
  await Store.setState(projectId, 'mode', state);
}

/**
 * Enable Silent Learner for a project.
 * @param {string} projectId
 * @returns {Promise<{ state: string }>}
 */
export async function enable(projectId) {
  // Initialize the database (creates schema if needed)
  await Store.getDatabase(projectId);
  await setState(projectId, 'observing');
  return { state: 'observing' };
}

/**
 * Disable Silent Learner for a project.
 * Data is preserved but no new events are captured.
 * @param {string} projectId
 * @returns {Promise<{ state: string }>}
 */
export async function disable(projectId) {
  await setState(projectId, 'off');
  return { state: 'off' };
}

/**
 * Toggle Silent Learner on/off.
 * @param {string} projectId
 * @param {boolean} enabled
 * @returns {Promise<{ state: string }>}
 */
export async function toggle(projectId, enabled) {
  if (enabled) {
    return enable(projectId);
  }
  return disable(projectId);
}

// ─── Event Capture ──────────────────────────────────────────────

/**
 * Capture a learning event from an AI interaction.
 * This is the primary hook called by the orchestrator after each interaction.
 *
 * @param {object} params - Parameters from buildCaptureEvent()
 * @param {string} params.projectId
 * @param {string[]} [excludedPaths] - File paths to exclude from learning
 * @returns {Promise<{ captured: boolean, eventId?: string, reason?: string }>}
 */
export async function captureEvent(params, excludedPaths = []) {
  const { projectId } = params;

  // Check if SL is enabled for this project
  const currentState = await getState(projectId);
  if (currentState === 'off') {
    return { captured: false, reason: 'silent_learner_disabled' };
  }

  // Build the capture event
  const event = Capture.buildCaptureEvent(params);

  // Check if event is high-signal enough to capture
  if (!Capture.isHighSignal(event)) {
    return { captured: false, reason: 'low_signal' };
  }

  // Privacy classification. Scan raw prompt/response text before storing only hashes/metadata.
  const lastUserMsg = params.messages?.filter(m => m.role === 'user').pop();
  const classification = Privacy.classifyInteraction({
    promptText: lastUserMsg?.content,
    responseText: params.result?.content,
    filesTouched: event.files_touched,
  }, excludedPaths);

  if (!classification.shouldStore) {
    // Log redaction but don't store the event
    console.log(`[SilentLearner] Event redacted: ${classification.dataClass}`);

    // If secrets were found, pause SL and record redaction
    if (classification.dataClass === Privacy.DataClass.SECRET) {
      try {
        await Store.insertRedactionLog(projectId, {
          event_id: null,
          redaction_type: 'secret',
          detail: `Redacted ${classification.findings.length} findings`,
        });
      } catch { /* best effort */ }

      await setState(projectId, 'paused');
      return { captured: false, reason: 'redacted_secret', paused: true };
    }

    return { captured: false, reason: `redacted_${classification.dataClass}` };
  }

  // Store the event
  event.data_class = classification.dataClass;
  const stored = await Store.insertEvent(projectId, event);

  // Update file usage scores (debounced)
  if (event.files_touched && event.files_touched.length > 0) {
    queueFileUsageUpdate(projectId, event.files_touched);

    // Also queue for progressive deep/relational re-enrichment with the active AI provider
    const { forceReenrich } = await import('./enrichment.mjs');
    for (const file of event.files_touched) {
      forceReenrich(projectId, file).catch(err =>
        console.warn(`[SilentLearner] Failed to queue re-enrichment for ${file}:`, err.message)
      );
    }
  }

  return { captured: true, eventId: stored.id };
}

// ─── Memory Building ────────────────────────────────────────────

/**
 * Build/rebuild memory packs from captured events.
 * Triggers the distillation pipeline.
 *
 * @param {string} projectId
 * @param {object} [options]
 * @param {function} [options.onProgress] - Progress callback
 * @returns {Promise<{ packsBuilt: number, totalLessons: number, state: string }>}
 */
export async function buildMemory(projectId, options = {}) {
  const currentState = await getState(projectId);
  if (currentState === 'off') {
    return { packsBuilt: 0, totalLessons: 0, state: 'off' };
  }

  await setState(projectId, 'distilling');

  try {
    const result = await MemoryPack.buildMemoryPacks(projectId, options);

    if (result.totalLessons > 0) {
      await setState(projectId, 'memory_ready');
      await Store.setState(projectId, 'last_build', new Date().toISOString());
    } else {
      await setState(projectId, 'observing');
    }

    return { ...result, state: await getState(projectId) };
  } catch (err) {
    console.error(`[SilentLearner] Memory build failed for ${projectId}:`, err);
    await setState(projectId, 'paused');
    throw err;
  }
}

// ─── Cold-Start Optimize Scan ───────────────────────────────────

/**
 * Run the "Optimize Memory" cold-start scan.
 * Scans existing chat history and files to build initial memory.
 * Uses regex-based patterns only (no model inference).
 *
 * @param {string} projectId
 * @param {object} [options]
 * @param {function} [options.onProgress] - Progress callback (progress: 0-100, detail: string)
 * @returns {Promise<{ eventsCreated: number, filesScanned: number, chatsScanned: number }>}
 */
export async function optimizeMemory(projectId, options = {}) {
  const { onProgress } = options;
  const project = await getProjectById(projectId);
  const priorState = await getState(projectId);

  // Initialize database schema/structures
  await Store.getDatabase(projectId);
  // Set temporary state to observing for scanning/building
  await setState(projectId, 'observing');

  let eventsCreated = 0;
  let filesScanned = 0;
  let chatsScanned = 0;

  if (onProgress) onProgress(5, 'Scanning project files...');

  try {
    // 1. Scan project files and build initial file scores
    const filesResult = await scanProjectFiles(projectId, project.path);
    filesScanned = filesResult.filesScanned;

    if (onProgress) onProgress(30, `Scanned ${filesScanned} files. Processing chat history...`);

    // 2. Scan chat history for co-occurrence patterns
    const chatResult = await scanChatHistory(projectId, project.path);
    chatsScanned = chatResult.chatsScanned;
    eventsCreated = chatResult.eventsCreated;

    if (onProgress) onProgress(70, `Processed ${chatsScanned} chats. Building memory packs...`);

    // 3. Build memory packs from discovered events
    if (eventsCreated > 0) {
      await buildMemory(projectId, {
        onProgress: (packType, count) => {
          if (onProgress) onProgress(80, `Built ${packType} (${count} lessons)`);
        },
      });
    }

    // 4. Flush debounced writes
    await flushUsageCache(projectId);
  } finally {
    // If the state was off, restore it to off
    if (priorState === 'off') {
      await setState(projectId, 'off');
    }
  }

  if (onProgress) onProgress(100, 'Optimization complete.');

  return { eventsCreated, filesScanned, chatsScanned };
}

/**
 * Scan project files to build initial file scores.
 * @param {string} projectId
 * @param {string} projectPath
 * @returns {Promise<{ filesScanned: number }>}
 */
async function scanProjectFiles(projectId, projectPath) {
  let filesScanned = 0;
  const now = new Date().toISOString();

  try {
    const entries = await fs.readdir(projectPath, { withFileTypes: true, recursive: false });

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (['.md', '.json', '.txt', '.yaml', '.yml'].includes(ext)) {
          const filePath = entry.name;
          try {
            const stat = await fs.stat(path.join(projectPath, filePath));
            await Store.upsertFileScore(projectId, {
              file_path: filePath,
              explicit_confidence: 0.5,
              usage_count: 1,
              last_modified_at: stat.mtime.toISOString(),
              last_used_at: now,
              computed_score: 0.5,
            });
            filesScanned++;
          } catch { /* skip inaccessible files */ }
        }
      }

      if (entry.isDirectory()) {
        // Scan artifact directories
        try {
          const subEntries = await fs.readdir(path.join(projectPath, entry.name));
          for (const subFile of subEntries) {
            if (subFile.endsWith('.md')) {
              const relPath = `${entry.name}/${subFile}`;
              await Store.upsertFileScore(projectId, {
                file_path: relPath,
                explicit_confidence: 0.5,
                usage_count: 1,
                last_modified_at: now,
                last_used_at: now,
                computed_score: 0.5,
              });
              filesScanned++;
            }
          }
        } catch { /* skip inaccessible dirs */ }
      }

      // Safety limit
      if (filesScanned >= 100) break;
    }
  } catch (err) {
    console.error(`[SilentLearner] File scan error:`, err.message);
  }

  return { filesScanned };
}

/**
 * Scan chat history to build initial learning events.
 * Uses regex to extract @file references and co-occurrence patterns.
 * @param {string} projectId
 * @param {string} projectPath
 * @returns {Promise<{ chatsScanned: number, eventsCreated: number }>}
 */
async function scanChatHistory(projectId, projectPath) {
  let chatsScanned = 0;
  let eventsCreated = 0;

  // Resolve current active provider and model
  let modelName = 'unknown';
  try {
    const settings = await readGlobalSettings();
    const providerType = settings.activeProvider || settings.active_provider || 'hostedApi';
    if (providerType === 'hostedApi' || providerType === 'hosted') {
      modelName = settings.hosted?.model || 'custom-model';
    } else if (settings[providerType]?.model) {
      modelName = settings[providerType].model;
    } else {
      modelName = providerType;
    }
  } catch {
    // Ignore and fallback
  }

  // Clear existing cold-start events to prevent duplicates if scan is re-run
  try {
    const db = await Store.getDatabase(projectId);
    db.prepare("DELETE FROM learning_events WHERE source = 'cold-start-scan'").run();
  } catch (err) {
    console.error('[SilentLearner] Failed to clear previous cold start events:', err.message);
  }

  const chatsDir = path.join(projectPath, 'chats');
  try {
    const chatFiles = await fs.readdir(chatsDir);
    const mdFiles = chatFiles.filter(f => f.endsWith('.md')).slice(0, 50); // Limit to 50

    for (const chatFile of mdFiles) {
      try {
        const content = await fs.readFile(path.join(chatsDir, chatFile), 'utf8');
        chatsScanned++;

        // Extract @file references using regex
        const fileRefs = extractFileReferences(content);

        // Build co-occurrence map
        if (fileRefs.length > 1) {
          for (const file of fileRefs) {
            const coOccurrence = fileRefs.filter(f => f !== file);
            const existing = await Store.getTopScoredFiles(projectId, 1, 0).catch(() => []);
            const current = existing.find(s => s.file_path === file);

            await Store.upsertFileScore(projectId, {
              file_path: file,
              explicit_confidence: current?.explicit_confidence ?? 0.5,
              usage_count: (current?.usage_count ?? 0) + 1,
              last_used_at: new Date().toISOString(),
              co_occurrence: coOccurrence.slice(0, 10),
              computed_score: current?.computed_score ?? 0.5,
            });
          }
        }

        // Create a synthetic learning event from the chat
        if (fileRefs.length > 0) {
          const artifactDirs = ['roadmaps', 'prds', 'initiatives', 'user-stories', 'one-pagers', 'pr-faqs', 'competitive-research', 'presentations', 'insights', 'product-visions'];
          let artifactChangeCount = 0;
          let fileChangeCount = 0;
          for (const ref of fileRefs) {
            const firstDir = ref.split('/')[0];
            if (artifactDirs.includes(firstDir)) {
              artifactChangeCount++;
            } else {
              fileChangeCount++;
            }
          }

          await Store.insertEvent(projectId, {
            session_id: `cold-start-${chatFile}`,
            source: 'cold-start-scan',
            task_type: classifyChatContent(content, fileRefs),
            files_touched: fileRefs,
            outcome: 'response_generated',
            accepted_changes: true,
            data_class: 'safe',
            metadata: { 
              coldStart: true, 
              chatFile,
              fileChangeCount,
              artifactChangeCount,
              model: modelName
            },
          });
          eventsCreated++;
        }
      } catch { /* skip unreadable chats */ }
    }
  } catch {
    // No chats directory — that's fine
  }

  return { chatsScanned, eventsCreated };
}

/**
 * Extract @file references and file paths from chat content.
 * @param {string} content
 * @returns {string[]}
 */
function extractFileReferences(content) {
  const refs = new Set();

  // Match @filename.md or @ArtifactName patterns
  const atPattern = /@([a-zA-Z0-9_\-/.]+\.(?:md|json|txt|yaml|yml|tsx?|jsx?|mjs|css))/g;
  let match;
  while ((match = atPattern.exec(content)) !== null) {
    refs.add(match[1]);
  }

  // Match file paths like roadmaps/foo.md, prds/bar.md
  const pathPattern = /(?:roadmaps|prds|initiatives|user-stories|one-pagers|pr-faqs|competitive-research|presentations|insights|product-visions)\/[a-zA-Z0-9_\-]+\.md/g;
  while ((match = pathPattern.exec(content)) !== null) {
    refs.add(match[0]);
  }

  return Array.from(refs);
}

function classifyChatContent(content, filesTouched = []) {
  return Capture.classifyText(content, filesTouched);
}

// ─── Forget Actions ─────────────────────────────────────────────

/**
 * Forget events from a specific session.
 * @param {string} projectId
 * @param {string} sessionId
 * @returns {Promise<{ deleted: number }>}
 */
export async function forgetSession(projectId, sessionId) {
  const deleted = await Store.deleteEventsBySession(projectId, sessionId);
  return { deleted };
}

/**
 * Forget ALL Silent Learner data for a workspace.
 * Nuclear option — deletes database, memory packs, and all derived data.
 * @param {string} projectId
 * @returns {Promise<void>}
 */
export async function forgetWorkspace(projectId) {
  // Cancel any debounced writes
  clearDebounce(projectId);
  usageCache.delete(projectId);

  // Destroy all data
  await Store.destroyAll(projectId);
}

// ─── Status & Retrieval ─────────────────────────────────────────

/**
 * Get the full Silent Learner status for a project.
 * @param {string} projectId
 * @returns {Promise<object>}
 */
export async function getStatus(projectId) {
  const state = await getState(projectId);

  if (state === 'off') {
    return {
      state: 'off',
      sessionsObserved: 0,
      qualifyingEvents: 0,
      lessonsLearned: 0,
      memoryPackCount: 0,
      lastUpdated: null,
      memoryPacks: [],
    };
  }

  try {
    const totalEvents = await Store.countEvents(projectId);
    const qualifyingEvents = await Store.countEvents(projectId, { data_class: 'safe' });
    const packs = await MemoryPack.listMemoryPacks(projectId);
    const totalLessons = packs.reduce((sum, p) => sum + p.event_count, 0);
    const lastBuild = await Store.getState(projectId, 'last_build');

    return {
      state,
      sessionsObserved: totalEvents,
      qualifyingEvents,
      lessonsLearned: totalLessons,
      memoryPackCount: packs.length,
      lastUpdated: lastBuild,
      memoryPacks: packs.map(p => ({
        name: p.name,
        packType: p.pack_type,
        eventCount: p.event_count,
        relevanceScore: p.relevance_score,
      })),
    };
  } catch {
    return {
      state,
      sessionsObserved: 0,
      qualifyingEvents: 0,
      lessonsLearned: 0,
      memoryPackCount: 0,
      lastUpdated: null,
      memoryPacks: [],
    };
  }
}

/**
 * Retrieve context for injection into AI prompts.
 * Delegates to the retrieval layer.
 * @param {string} projectId
 * @param {object} [options]
 * @returns {Promise<object>}
 */
export async function retrieveContext(projectId, options = {}) {
  const state = await getState(projectId);
  if (state === 'off' || state === 'paused') {
    return { contextBlock: '', filesUsed: [], packsUsed: [], stats: {} };
  }

  return Retrieval.retrieveContext(projectId, options);
}

/**
 * Export all memory packs for download.
 * @param {string} projectId
 * @returns {Promise<object>}
 */
export async function exportMemory(projectId) {
  return MemoryPack.exportAllPacks(projectId);
}

// ─── Debounced File Usage ───────────────────────────────────────

/**
 * Queue file usage updates for debounced writing.
 * Per NFR: writes to .metadata/artifacts.json are debounced by 30s.
 * @param {string} projectId
 * @param {string[]} files
 */
function queueFileUsageUpdate(projectId, files) {
  if (!usageCache.has(projectId)) {
    usageCache.set(projectId, new Set());
  }

  const cache = usageCache.get(projectId);
  for (const file of files) {
    cache.add(file);
  }

  // Reset debounce timer
  clearDebounce(projectId);
  debounceTimers.set(projectId, setTimeout(() => {
    flushUsageCache(projectId).catch(err =>
      console.error(`[SilentLearner] Debounced flush failed:`, err.message)
    );
  }, DEBOUNCE_MS));
}

/**
 * Flush the usage cache to SQLite.
 * @param {string} projectId
 * @returns {Promise<void>}
 */
async function flushUsageCache(projectId) {
  const cache = usageCache.get(projectId);
  if (!cache || cache.size === 0) return;

  for (const file of cache) {
    await Store.incrementFileUsage(projectId, file);
  }

  cache.clear();
  clearDebounce(projectId);
}

/**
 * Clear the debounce timer for a project.
 * @param {string} projectId
 */
function clearDebounce(projectId) {
  const timer = debounceTimers.get(projectId);
  if (timer) {
    clearTimeout(timer);
    debounceTimers.delete(projectId);
  }
}

/**
 * Flush all usage caches. Called on shutdown.
 * @returns {Promise<void>}
 */
export async function flushAll() {
  for (const projectId of usageCache.keys()) {
    await flushUsageCache(projectId);
  }
}

/**
 * Shutdown hook. Flushes caches and closes databases.
 * @returns {Promise<void>}
 */
export async function shutdown() {
  await flushAll();
  Store.closeAll();
}

/**
 * Record a file observation (opening/reading/querying a file).
 * Updates/increments usage scores (debounced) and saves the lastObserved timestamp in the sidecar.
 * 
 * @param {string} projectId
 * @param {string} filePath
 * @returns {Promise<void>}
 */
export async function observeFile(projectId, filePath) {
  // Check if SL is enabled for this project
  const currentState = await getState(projectId);
  if (currentState === 'off') {
    return;
  }

  // 1. Update/increment usage score (debounced) in SQLite
  queueFileUsageUpdate(projectId, [filePath]);

  // 2. Asynchronously update lastObserved in sidecar JSON
  try {
    let sidecarRelPath;
    try {
      sidecarRelPath = getSidecarPath(filePath);
    } catch {
      // If the file path is not supported for sidecars (e.g. non-.md files), skip sidecar update
      return;
    }

    const project = await getProjectById(projectId);
    const sidecarPath = await safeJoin(project.path, sidecarRelPath);
    let sidecar;
    try {
      sidecar = JSON.parse(await fs.readFile(sidecarPath, 'utf8'));
    } catch {
      // If no sidecar exists, run immediate stage first
      const { enrichImmediate } = await import('./enrichment.mjs');
      sidecar = await enrichImmediate(projectId, filePath);
    }

    if (!sidecar.silentLearner) {
      sidecar.silentLearner = {};
    }

    sidecar.silentLearner.lastObserved = new Date().toISOString();
    sidecar.updated = new Date().toISOString();

    await fs.writeFile(sidecarPath, JSON.stringify(sidecar, null, 2), 'utf8');
  } catch (err) {
    console.warn(`[SilentLearner] Failed to update lastObserved for ${filePath}:`, err.message);
  }
}
