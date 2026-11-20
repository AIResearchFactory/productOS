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
import { safeJsonParse } from '../safe-json.mjs';

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
  created_at TEXT NOT NULL,
  session_id TEXT,
  chat_file TEXT,
  findings TEXT,
  status TEXT DEFAULT 'pending',
  resolution_action TEXT,
  resolved_at TEXT
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
 * Check whether a Silent Learner SQLite database already exists for a project.
 * Does not create or open the database if absent.
 * @param {string} projectId
 * @returns {Promise<boolean>}
 */
export async function hasDatabase(projectId) {
  if (dbCache.has(projectId)) {
    return true;
  }
  if (dbPromiseCache.has(projectId)) {
    try {
      await dbPromiseCache.get(projectId);
      return true;
    } catch {
      return false;
    }
  }
  try {
    const project = await getProjectById(projectId);
    await fs.access(path.join(project.path, '.metadata', 'memory.db'));
    return true;
  } catch {
    return false;
  }
}

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

      // WAL mode and busy_timeout for concurrent read/write
      db.pragma('journal_mode = WAL');
      db.pragma('busy_timeout = 5000');
      db.pragma('foreign_keys = ON');

      // Initialize schema and migrate legacy databases
      db.exec(SCHEMA_SQL);
      migrateSchema(db);

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
 * Delete learning events linked to a specific chat file (by session_id or metadata.chatFile).
 * @param {string} projectId
 * @param {string} chatFile
 * @returns {Promise<number>} count of deleted rows
 */
export async function deleteEventsByChatFile(projectId, chatFile) {
  if (!chatFile) return 0;
  const db = await getDatabase(projectId);
  const coldStartSession = `cold-start-${chatFile}`;
  let deleted = 0;

  const tx = db.transaction(() => {
    const direct = db
      .prepare('DELETE FROM learning_events WHERE session_id = ? OR session_id = ?')
      .run(chatFile, coldStartSession);
    deleted += direct.changes;

    const remaining = db
      .prepare('SELECT id, metadata FROM learning_events WHERE metadata IS NOT NULL')
      .all();
    const deleteStmt = db.prepare('DELETE FROM learning_events WHERE id = ?');
    for (const row of remaining) {
      try {
        const meta = safeJsonParse(row.metadata);
        if (meta && meta.chatFile === chatFile) {
          deleted += deleteStmt.run(row.id).changes;
        }
      } catch {
        // Ignore malformed metadata JSON
      }
    }
  });

  tx();
  return deleted;
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
  const now = log.created_at || new Date().toISOString();
  const status = log.status || 'pending';
  const findingsJson = Array.isArray(log.findings) ? JSON.stringify(log.findings) : null;

  db.prepare(`
    INSERT INTO redaction_logs (
      id, event_id, redaction_type, detail, created_at,
      session_id, chat_file, findings, status, resolution_action, resolved_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    log.event_id ?? null,
    log.redaction_type,
    log.detail || null,
    now,
    log.session_id || null,
    log.chat_file || null,
    findingsJson,
    status,
    log.resolution_action || null,
    log.resolved_at || null
  );

  return deserializeRedactionLog({
    id,
    event_id: log.event_id ?? null,
    redaction_type: log.redaction_type,
    detail: log.detail || null,
    created_at: now,
    session_id: log.session_id || null,
    chat_file: log.chat_file || null,
    findings: findingsJson,
    status,
    resolution_action: log.resolution_action || null,
    resolved_at: log.resolved_at || null,
  });
}

/**
 * Get redaction logs, optionally filtered by event_id.
 * @param {string} projectId
 * @param {string} [eventId]
 * @returns {Promise<object[]>}
 */
export async function getRedactionLogs(projectId, eventId) {
  const db = await getDatabase(projectId);
  const rows = eventId
    ? db.prepare('SELECT * FROM redaction_logs WHERE event_id = ? ORDER BY created_at DESC').all(eventId)
    : db.prepare('SELECT * FROM redaction_logs ORDER BY created_at DESC').all();
  return rows.map(deserializeRedactionLog);
}

/**
 * Get a single redaction log entry by ID.
 * @param {string} projectId
 * @param {string} redactionId
 * @returns {Promise<object | null>}
 */
export async function getRedactionLogById(projectId, redactionId) {
  if (!redactionId) return null;
  const db = await getDatabase(projectId);
  const row = db.prepare('SELECT * FROM redaction_logs WHERE id = ?').get(redactionId);
  return deserializeRedactionLog(row);
}

/**
 * Mark a redaction log entry resolved and optionally supersede older pending entries.
 * @param {string} projectId
 * @param {string} redactionId
 * @param {object} options
 * @param {string} options.status
 * @param {string} [options.resolutionAction]
 * @param {boolean} [options.resolveOlderPending=true]
 * @returns {Promise<object | null>}
 */
export async function resolveRedactionLog(projectId, redactionId, { status, resolutionAction, resolveOlderPending = true }) {
  const db = await getDatabase(projectId);
  const target = db.prepare('SELECT * FROM redaction_logs WHERE id = ?').get(redactionId);
  if (!target) {
    const err = new Error(`Redaction log not found: ${redactionId}`);
    err.statusCode = 404;
    throw err;
  }

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE redaction_logs
      SET status = ?, resolution_action = ?, resolved_at = ?
      WHERE id = ?
    `).run(status, resolutionAction || status, now, redactionId);

    if (resolveOlderPending) {
      db.prepare(`
        UPDATE redaction_logs
        SET status = 'acknowledged', resolution_action = 'superseded', resolved_at = ?
        WHERE (status IS NULL OR status = 'pending')
          AND created_at <= ?
          AND id != ?
      `).run(now, target.created_at, redactionId);
    }
  });

  tx();
  return getRedactionLogById(projectId, redactionId);
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
  if (!(await hasDatabase(projectId))) {
    return null;
  }
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
  let vector = [];
  if (row.vector) {
    try {
      const parsed = safeJsonParse(row.vector);
      if (Array.isArray(parsed)) vector = parsed;
    } catch {
      vector = [];
    }
  }
  return {
    ...row,
    vector
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

/**
 * Record feedback on an adversarial critic finding (applied or dismissed).
 * @param {string} projectId
 * @param {object} feedback
 * @returns {Promise<{ success: boolean, updatedRulesCount?: number }>}
 */
export async function recordCriticFeedback(projectId, feedback = {}) {
  const db = await getDatabase(projectId);
  const now = new Date().toISOString();
  const eventId = `evt-crit-${randomUUID().slice(0, 8)}`;
  const { findingId, action, critic, learnedRule, finding } = feedback;

  // Insert learning event
  db.prepare(`
    INSERT INTO learning_events (id, session_id, source, task_type, accepted_changes, created_at, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    eventId,
    'critic-review',
    'critic_feedback',
    'adversarial_audit',
    action === 'applied' ? 1 : 0,
    now,
    JSON.stringify({ findingId, action, critic, learnedRule, finding })
  );

  // If rule is provided or fix was applied, persist learned rule to markdown context
  let updatedRulesCount = 0;
  if (projectId) {
    try {
      const project = await getProjectById(projectId);
      if (project?.path) {
        const contextDir = path.join(project.path, '.metadata', '_context');
        await fs.mkdir(contextDir, { recursive: true });
        const prefPath = path.join(contextDir, 'learned-preferences.md');
        
        let existingContent = '';
        try {
          existingContent = await fs.readFile(prefPath, 'utf8');
        } catch {
          existingContent = '# Project Learned Preferences & Rules\n\n> Automatically calibrated from PM decisions and adversarial critic reviews.\n\n';
        }

        const ruleText = learnedRule || (finding ? `[Critic ${critic}] ${finding.title}: ${finding.suggestedFix}` : null);
        if (ruleText && !existingContent.includes(ruleText)) {
          const ruleLine = `- **${critic || 'Critic Rule'}**: ${ruleText} *(calibrated ${now.slice(0, 10)})*\n`;
          await fs.writeFile(prefPath, existingContent.trimEnd() + '\n' + ruleLine, 'utf8');
          updatedRulesCount = 1;
        }
      }
    } catch (err) {
      console.warn('[recordCriticFeedback] Non-fatal error updating learned-preferences.md:', err.message);
    }
  }

  return { success: true, updatedRulesCount };
}

/**
 * Record a user decision or choice during Socratic grilling.
 * @param {string} projectId
 * @param {object} decision
 * @returns {Promise<{ success: boolean }>}
 */
export async function recordSocraticDecision(projectId, decision = {}) {
  const db = await getDatabase(projectId);
  const now = new Date().toISOString();
  const eventId = `evt-soc-${randomUUID().slice(0, 8)}`;
  const { artifactType, questionId, question, answer, mode } = decision;

  db.prepare(`
    INSERT INTO learning_events (id, session_id, source, task_type, accepted_changes, created_at, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    eventId,
    'socratic-interview',
    'socratic_interrogator',
    'clarification_decision',
    1,
    now,
    JSON.stringify({ artifactType, questionId, question, answer, mode })
  );

  // If user provided a specific non-default decision, save to preferences
  if (projectId && answer && !answer.toLowerCase().includes('decide for me')) {
    try {
      const project = await getProjectById(projectId);
      if (project?.path) {
        const contextDir = path.join(project.path, '.metadata', '_context');
        await fs.mkdir(contextDir, { recursive: true });
        const prefPath = path.join(contextDir, 'learned-preferences.md');

        let existingContent = '';
        try {
          existingContent = await fs.readFile(prefPath, 'utf8');
        } catch {
          existingContent = '# Project Learned Preferences & Rules\n\n> Automatically calibrated from PM decisions and adversarial critic reviews.\n\n';
        }

        const decisionLine = `- **Socratic [${artifactType || 'spec'}]**: ${question} $\\rightarrow$ **${answer}** *(decision recorded ${now.slice(0, 10)})*\n`;
        const decisionKey = `${question} $\\rightarrow$ **${answer}**`;
        if (!existingContent.includes(decisionKey)) {
          await fs.writeFile(prefPath, existingContent.trimEnd() + '\n' + decisionLine, 'utf8');
        }
      }
    } catch (err) {
      console.warn('[recordSocraticDecision] Non-fatal error updating learned-preferences.md:', err.message);
    }
  }

  return { success: true };
}

// ─── Helpers ────────────────────────────────────────────────────

function migrateSchema(db) {
  const columns = db.prepare('PRAGMA table_info(redaction_logs)').all();
  const existing = new Set(columns.map((c) => c.name));

  const migrations = [
    ['session_id', 'TEXT'],
    ['chat_file', 'TEXT'],
    ['findings', 'TEXT'],
    ['status', "TEXT DEFAULT 'pending'"],
    ['resolution_action', 'TEXT'],
    ['resolved_at', 'TEXT'],
  ];

  for (const [name, definition] of migrations) {
    if (!existing.has(name)) {
      db.exec(`ALTER TABLE redaction_logs ADD COLUMN ${name} ${definition}`);
    }
  }
}

function deserializeRedactionLog(row) {
  if (!row) return null;
  let findings = null;
  if (row.findings) {
    try {
      const parsed = safeJsonParse(row.findings);
      if (Array.isArray(parsed)) {
        findings = parsed;
      }
    } catch {
      findings = null;
    }
  }

  return {
    ...row,
    findings,
    status: row.status || 'pending',
  };
}

function deserializeEvent(row) {
  let filesTouched = [];
  if (row.files_touched) {
    try {
      const parsed = safeJsonParse(row.files_touched);
      if (Array.isArray(parsed)) filesTouched = parsed;
    } catch {
      filesTouched = [];
    }
  }

  let metadata = null;
  if (row.metadata) {
    try {
      metadata = safeJsonParse(row.metadata);
    } catch {
      metadata = null;
    }
  }

  return {
    ...row,
    accepted_changes: !!row.accepted_changes,
    files_touched: filesTouched,
    metadata,
  };
}

