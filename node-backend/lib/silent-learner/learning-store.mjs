/**
 * learning-store.mjs
 * SQLite-backed storage for Silent Learner events, memory packs, and file scores.
 * Each project gets its own database at .metadata/memory.db.
 * Uses better-sqlite3 in WAL mode for concurrent read/write.
 */

import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { getProjectById } from '../projects.mjs';
import { safeJoin } from '../paths.mjs';

/** @type {Map<string, Database>} */
const dbCache = new Map();

/** @type {Map<string, Promise<Database>>} */
const dbPromiseCache = new Map();

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS learning_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  source TEXT NOT NULL,
  task_type TEXT,
  prompt_hash TEXT,
  response_hash TEXT,
  accepted_changes INTEGER DEFAULT 0,
  files_touched TEXT,
  outcome TEXT,
  data_class TEXT DEFAULT 'safe',
  created_at TEXT NOT NULL,
  metadata TEXT
);

CREATE TABLE IF NOT EXISTS redaction_logs (
  id TEXT PRIMARY KEY,
  event_id TEXT REFERENCES learning_events(id) ON DELETE CASCADE,
  redaction_type TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memory_packs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pack_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  relevance_score REAL DEFAULT 0.5,
  event_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS file_scores (
  file_path TEXT PRIMARY KEY,
  explicit_confidence REAL DEFAULT 0.5,
  usage_count INTEGER DEFAULT 0,
  last_used_at TEXT,
  last_modified_at TEXT,
  co_occurrence TEXT,
  active_boost REAL DEFAULT 0.0,
  computed_score REAL DEFAULT 0.5
);

CREATE TABLE IF NOT EXISTS sl_state (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS embeddings (
  id TEXT PRIMARY KEY,
  embedding_type TEXT NOT NULL,
  content TEXT NOT NULL,
  vector TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS document_summaries (
  file_path TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  summary TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_session ON learning_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_source ON learning_events(source);
CREATE INDEX IF NOT EXISTS idx_events_created ON learning_events(created_at);
CREATE INDEX IF NOT EXISTS idx_scores_computed ON file_scores(computed_score DESC);
`;

/**
 * Get or create a SQLite database for a project.
 * @param {string} projectId
 * @returns {Promise<Database>}
 */
export async function getDatabase(projectId) {
  if (dbCache.has(projectId)) {
    return dbCache.get(projectId);
  }
  if (dbPromiseCache.has(projectId)) {
    return dbPromiseCache.get(projectId);
  }

  const promise = (async () => {
    try {
      const project = await getProjectById(projectId);
      const metadataDir = await safeJoin(project.path, '.metadata');
      await fs.mkdir(metadataDir, { recursive: true });

      const dbPath = path.join(metadataDir, 'memory.db');
      const db = new Database(dbPath);

      // WAL mode for concurrent read/write
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');

      // Initialize schema
      db.exec(SCHEMA_SQL);

      dbCache.set(projectId, db);
      return db;
    } finally {
      dbPromiseCache.delete(projectId);
    }
  })();

  dbPromiseCache.set(projectId, promise);
  return promise;
}

/**
 * Close and remove a project's database from the cache.
 * @param {string} projectId
 */
export function closeDatabase(projectId) {
  const db = dbCache.get(projectId);
  if (db) {
    try { db.close(); } catch { /* already closed */ }
    dbCache.delete(projectId);
  }
}

/**
 * Close all cached databases. Call on shutdown.
 */
export function closeAll() {
  for (const [id, db] of dbCache) {
    try { db.close(); } catch { /* ignore */ }
  }
  dbCache.clear();
}

// ─── Learning Events ────────────────────────────────────────────

/**
 * Insert a new learning event.
 * @param {string} projectId
 * @param {object} event
 * @returns {Promise<object>}
 */
export async function insertEvent(projectId, event) {
  const db = await getDatabase(projectId);
  const id = event.id || randomUUID();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO learning_events (id, session_id, source, task_type, prompt_hash, response_hash,
      accepted_changes, files_touched, outcome, data_class, created_at, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    event.session_id || randomUUID(),
    event.source || 'unknown',
    event.task_type || null,
    event.prompt_hash || null,
    event.response_hash || null,
    event.accepted_changes ? 1 : 0,
    event.files_touched ? JSON.stringify(event.files_touched) : null,
    event.outcome || null,
    event.data_class || 'safe',
    event.created_at || now,
    event.metadata ? JSON.stringify(event.metadata) : null
  );

  return { id, ...event, created_at: event.created_at || now };
}

/**
 * Get all events for a project, optionally filtered.
 * @param {string} projectId
 * @param {object} [filters]
 * @returns {Promise<object[]>}
 */
export async function getEvents(projectId, filters = {}) {
  const db = await getDatabase(projectId);
  let sql = 'SELECT * FROM learning_events WHERE 1=1';
  const params = [];

  if (filters.session_id) {
    sql += ' AND session_id = ?';
    params.push(filters.session_id);
  }
  if (filters.source) {
    sql += ' AND source = ?';
    params.push(filters.source);
  }
  if (filters.data_class) {
    sql += ' AND data_class = ?';
    params.push(filters.data_class);
  }
  if (filters.outcome) {
    sql += ' AND outcome = ?';
    params.push(filters.outcome);
  }

  sql += ' ORDER BY created_at DESC';

  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }

  const rows = db.prepare(sql).all(...params);
  return rows.map(deserializeEvent);
}

/**
 * Count events matching filters.
 * @param {string} projectId
 * @param {object} [filters]
 * @returns {Promise<number>}
 */
export async function countEvents(projectId, filters = {}) {
  const db = await getDatabase(projectId);
  let sql = 'SELECT COUNT(*) as count FROM learning_events WHERE 1=1';
  const params = [];

  if (filters.data_class) {
    sql += ' AND data_class = ?';
    params.push(filters.data_class);
  }
  if (filters.outcome) {
    sql += ' AND outcome = ?';
    params.push(filters.outcome);
  }

  return db.prepare(sql).get(...params).count;
}

/**
 * Delete events by session ID.
 * @param {string} projectId
 * @param {string} sessionId
 * @returns {Promise<number>} count of deleted rows
 */
export async function deleteEventsBySession(projectId, sessionId) {
  const db = await getDatabase(projectId);
  const result = db.prepare('DELETE FROM learning_events WHERE session_id = ?').run(sessionId);
  return result.changes;
}

/**
 * Delete all events for a project.
 * @param {string} projectId
 * @returns {Promise<number>}
 */
export async function deleteAllEvents(projectId) {
  const db = await getDatabase(projectId);
  const result = db.prepare('DELETE FROM learning_events').run();
  return result.changes;
}

// ─── Redaction Logs ─────────────────────────────────────────────

/**
 * Insert a redaction log entry.
 * @param {string} projectId
 * @param {object} log
 * @returns {Promise<object>}
 */
export async function insertRedactionLog(projectId, log) {
  const db = await getDatabase(projectId);
  const id = log.id || randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO redaction_logs (id, event_id, redaction_type, detail, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, log.event_id, log.redaction_type, log.detail || null, now);

  return { id, ...log, created_at: now };
}

/**
 * Get redaction logs, optionally filtered by event_id.
 * @param {string} projectId
 * @param {string} [eventId]
 * @returns {Promise<object[]>}
 */
export async function getRedactionLogs(projectId, eventId) {
  const db = await getDatabase(projectId);
  if (eventId) {
    return db.prepare('SELECT * FROM redaction_logs WHERE event_id = ? ORDER BY created_at DESC').all(eventId);
  }
  return db.prepare('SELECT * FROM redaction_logs ORDER BY created_at DESC').all();
}

// ─── Memory Packs ───────────────────────────────────────────────

/**
 * Upsert a memory pack record.
 * @param {string} projectId
 * @param {object} pack
 * @returns {Promise<object>}
 */
export async function upsertMemoryPack(projectId, pack) {
  const db = await getDatabase(projectId);
  const id = pack.id || randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO memory_packs (id, name, pack_type, file_path, relevance_score, event_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      pack_type = excluded.pack_type,
      file_path = excluded.file_path,
      relevance_score = excluded.relevance_score,
      event_count = excluded.event_count,
      updated_at = excluded.updated_at
  `).run(
    id,
    pack.name,
    pack.pack_type,
    pack.file_path,
    pack.relevance_score ?? 0.5,
    pack.event_count ?? 0,
    pack.created_at || now,
    now
  );

  return { id, ...pack, updated_at: now };
}

/**
 * List all memory packs for a project.
 * @param {string} projectId
 * @returns {Promise<object[]>}
 */
export async function listMemoryPacks(projectId) {
  const db = await getDatabase(projectId);
  return db.prepare('SELECT * FROM memory_packs ORDER BY relevance_score DESC').all();
}

/**
 * Delete all memory packs for a project.
 * @param {string} projectId
 * @returns {Promise<number>}
 */
export async function deleteAllMemoryPacks(projectId) {
  const db = await getDatabase(projectId);
  return db.prepare('DELETE FROM memory_packs').run().changes;
}

// ─── File Scores ────────────────────────────────────────────────

/**
 * Upsert a file score record.
 * @param {string} projectId
 * @param {object} score
 * @returns {Promise<void>}
 */
export async function upsertFileScore(projectId, score) {
  const db = await getDatabase(projectId);

  db.prepare(`
    INSERT INTO file_scores (file_path, explicit_confidence, usage_count, last_used_at, last_modified_at,
      co_occurrence, active_boost, computed_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(file_path) DO UPDATE SET
      explicit_confidence = excluded.explicit_confidence,
      usage_count = excluded.usage_count,
      last_used_at = excluded.last_used_at,
      last_modified_at = excluded.last_modified_at,
      co_occurrence = excluded.co_occurrence,
      active_boost = excluded.active_boost,
      computed_score = excluded.computed_score
  `).run(
    score.file_path,
    score.explicit_confidence ?? 0.5,
    score.usage_count ?? 0,
    score.last_used_at || null,
    score.last_modified_at || null,
    score.co_occurrence ? JSON.stringify(score.co_occurrence) : null,
    score.active_boost ?? 0.0,
    score.computed_score ?? 0.5
  );
}

/**
 * Increment usage count for a file.
 * @param {string} projectId
 * @param {string} filePath
 * @returns {Promise<void>}
 */
export async function incrementFileUsage(projectId, filePath) {
  const db = await getDatabase(projectId);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO file_scores (file_path, usage_count, last_used_at, computed_score)
    VALUES (?, 1, ?, 0.5)
    ON CONFLICT(file_path) DO UPDATE SET
      usage_count = usage_count + 1,
      last_used_at = ?
  `).run(filePath, now, now);
}

/**
 * Get top-scored files.
 * @param {string} projectId
 * @param {number} [limit=20]
 * @param {number} [minScore=0.0]
 * @returns {Promise<object[]>}
 */
export async function getTopScoredFiles(projectId, limit = 20, minScore = 0.0) {
  const db = await getDatabase(projectId);
  return db.prepare(
    'SELECT * FROM file_scores WHERE computed_score >= ? ORDER BY computed_score DESC LIMIT ?'
  ).all(minScore, limit);
}

/**
 * Delete all file scores for a project.
 * @param {string} projectId
 * @returns {Promise<number>}
 */
export async function deleteAllFileScores(projectId) {
  const db = await getDatabase(projectId);
  return db.prepare('DELETE FROM file_scores').run().changes;
}

// ─── SL State ───────────────────────────────────────────────────

/**
 * Get a Silent Learner state value.
 * @param {string} projectId
 * @param {string} key
 * @returns {Promise<string|null>}
 */
export async function getState(projectId, key) {
  const db = await getDatabase(projectId);
  const row = db.prepare('SELECT value FROM sl_state WHERE key = ?').get(key);
  return row ? row.value : null;
}

/**
 * Set a Silent Learner state value.
 * @param {string} projectId
 * @param {string} key
 * @param {string} value
 * @returns {Promise<void>}
 */
export async function setState(projectId, key, value) {
  const db = await getDatabase(projectId);
  db.prepare(`
    INSERT INTO sl_state (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

/**
 * Delete all SL state for a project.
 * @param {string} projectId
 * @returns {Promise<void>}
 */
export async function clearState(projectId) {
  const db = await getDatabase(projectId);
  db.prepare('DELETE FROM sl_state').run();
}

// ─── Full Wipe ──────────────────────────────────────────────────

/**
 * Completely delete all Silent Learner data for a project.
 * Drops database and deletes memory-packs directory.
 * @param {string} projectId
 * @returns {Promise<void>}
 */
export async function destroyAll(projectId) {
  // Close and remove cached connection
  closeDatabase(projectId);

  const project = await getProjectById(projectId);
  const metadataDir = await safeJoin(project.path, '.metadata');

  // Delete database file
  const dbPath = path.join(metadataDir, 'memory.db');
  await fs.rm(dbPath, { force: true });
  // WAL and SHM files
  await fs.rm(dbPath + '-wal', { force: true });
  await fs.rm(dbPath + '-shm', { force: true });

  // Delete memory-packs directory
  const packsDir = path.join(metadataDir, 'memory-packs');
  await fs.rm(packsDir, { recursive: true, force: true });
}

// ─── Embeddings and Summaries ───────────────────────────────────

/**
 * Upsert an embedding.
 * @param {string} projectId
 * @param {string} id
 * @param {string} type
 * @param {string} content
 * @param {number[]} vector
 * @returns {Promise<void>}
 */
export async function upsertEmbedding(projectId, id, type, content, vector) {
  const db = await getDatabase(projectId);
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO embeddings (id, embedding_type, content, vector, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      embedding_type = excluded.embedding_type,
      content = excluded.content,
      vector = excluded.vector,
      updated_at = excluded.updated_at
  `).run(id, type, content, JSON.stringify(vector), now);
}

/**
 * Get an embedding by ID.
 * @param {string} projectId
 * @param {string} id
 * @returns {Promise<{ id: string, embedding_type: string, content: string, vector: number[], updated_at: string } | null>}
 */
export async function getEmbedding(projectId, id) {
  const db = await getDatabase(projectId);
  const row = db.prepare('SELECT * FROM embeddings WHERE id = ?').get(id);
  if (!row) return null;
  return {
    ...row,
    vector: JSON.parse(row.vector)
  };
}

/**
 * Upsert a document summary.
 * @param {string} projectId
 * @param {string} filePath
 * @param {string} hash
 * @param {string} summary
 * @returns {Promise<void>}
 */
export async function upsertSummary(projectId, filePath, hash, summary) {
  const db = await getDatabase(projectId);
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO document_summaries (file_path, content_hash, summary, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(file_path) DO UPDATE SET
      content_hash = excluded.content_hash,
      summary = excluded.summary,
      updated_at = excluded.updated_at
  `).run(filePath, hash, summary, now);
}

/**
 * Get a document summary by file path.
 * @param {string} projectId
 * @param {string} filePath
 * @returns {Promise<{ file_path: string, content_hash: string, summary: string, updated_at: string } | null>}
 */
export async function getSummary(projectId, filePath) {
  const db = await getDatabase(projectId);
  return db.prepare('SELECT * FROM document_summaries WHERE file_path = ?').get(filePath) || null;
}

// ─── Helpers ────────────────────────────────────────────────────

function deserializeEvent(row) {
  return {
    ...row,
    accepted_changes: !!row.accepted_changes,
    files_touched: row.files_touched ? JSON.parse(row.files_touched) : [],
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  };
}
