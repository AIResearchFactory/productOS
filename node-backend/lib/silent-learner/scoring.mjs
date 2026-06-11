/**
 * scoring.mjs
 * Multi-signal relevance scoring engine for Silent Learner.
 * 
 * Computes relevance scores for files and interactions using:
 *   S = (w_explicit * C + w_usage * U + w_recency * R + w_alignment * A) × M_type × M_active
 *
 * Signals:
 *   - Explicit Confidence (C): User-set confidence for artifacts (0.0–1.0)
 *   - Usage Consistency (U): Normalized access/edit frequency in a sliding window
 *   - Recency & Decay (R): Exponential decay e^(-λt) from last modification/use
 *   - Task Alignment (A): Keyword-based similarity to active workspace goal
 *   - Categorization Modifier (M_type): Multiplier by file/content type
 *   - Active State Modifier (M_active): Temporary boosts (git state, error context)
 *
 * Score Thresholds:
 *   - S ≥ 0.7: Active Context (loaded into prompt)
 *   - 0.4 ≤ S < 0.7: RAG Only (retrieved conditionally)
 *   - S < 0.4: Cold Storage (excluded from context)
 */

import { computeSemanticAlignment, getProjectFileContent } from './vector-index.mjs';

/** Default signal weights. */
const WEIGHTS = {
  explicit: 0.25,    // w_explicit
  usage: 0.30,       // w_usage
  recency: 0.25,     // w_recency
  alignment: 0.20,   // w_alignment
};

/** Recency decay constant (λ). Higher = faster decay. */
const DECAY_LAMBDA = 0.05; // ~14 day half-life

/** Maximum usage count for normalization. */
const MAX_USAGE_FOR_NORMALIZATION = 50;

/** Categorization type multipliers. */
const TYPE_MULTIPLIERS = {
  // Internal/Generated Artifacts — high semantic value
  roadmap: 1.2,
  initiative: 1.2,
  prd: 1.3,
  user_story: 1.1,
  pr_faq: 1.1,
  product_vision: 1.2,
  one_pager: 1.0,
  competitive_research: 0.9,
  presentation: 0.8,
  insight: 1.0,

  // External Reference Content — scored on usage, not ownership
  external: 0.7,
  imported: 0.7,

  // Conversations & Operational Logs — never loaded raw
  chat_log: 0.3,
  research_log: 0.4,

  // Memory Packs — high value, compact
  memory_pack: 1.4,

  // Default for unclassified files
  default: 1.0,
};

/** Active state boost values. */
const ACTIVE_BOOSTS = {
  git_uncommitted: 0.5,   // File has unstaged or uncommitted changes
  error_context: 0.8,     // File referenced in last test/compile failure
  recently_opened: 0.3,   // File opened in editor in last 5 minutes
};

/** Score threshold constants. */
export const THRESHOLDS = {
  ACTIVE_CONTEXT: 0.7,
  RAG_ONLY: 0.4,
  COLD_STORAGE: 0.0,
};

/**
 * Compute the relevance score for a file or content item.
 *
 * @param {object} params
 * @param {number} [params.explicitConfidence=0.5] - User-set confidence (0.0–1.0)
 * @param {number} [params.usageCount=0] - Number of accesses/edits
 * @param {string|null} [params.lastUsedAt] - ISO timestamp of last use
 * @param {string|null} [params.lastModifiedAt] - ISO timestamp of last modification
 * @param {string} [params.fileType='default'] - Content type key for multiplier
 * @param {number} [params.activeBoost=0.0] - Temporary active state boost
 * @param {number} [params.taskAlignment=0.5] - Task alignment score (0.0–1.0)
 * @param {object} [params.weights] - Override default signal weights
 * @returns {{ score: number, tier: string, breakdown: object }}
 */
export function computeScore(params = {}) {
  const {
    explicitConfidence = 0.5,
    usageCount = 0,
    lastUsedAt = null,
    lastModifiedAt = null,
    fileType = 'default',
    activeBoost = 0.0,
    taskAlignment = 0.5,
    weights = WEIGHTS,
  } = params;

  // C: Explicit Confidence (0.0–1.0)
  const C = Math.max(0, Math.min(1, explicitConfidence));

  // U: Usage Consistency (normalized 0.0–1.0)
  const U = Math.min(1.0, usageCount / MAX_USAGE_FOR_NORMALIZATION);

  // R: Recency Decay (e^(-λt))
  const R = computeRecencyDecay(lastUsedAt, lastModifiedAt);

  // A: Task Alignment (0.0–1.0)
  const A = Math.max(0, Math.min(1, taskAlignment));

  // Base score from weighted signals
  const baseScore = (weights.explicit * C) + (weights.usage * U) + (weights.recency * R) + (weights.alignment * A);

  // M_type: Categorization modifier
  const M_type = TYPE_MULTIPLIERS[fileType] || TYPE_MULTIPLIERS.default;

  // M_active: Active state modifier (1.0 + boost, capped at 2.0)
  const M_active = Math.min(2.0, 1.0 + activeBoost);

  // Final score (capped at 1.0)
  const score = Math.min(1.0, baseScore * M_type * M_active);

  // Determine tier
  let tier;
  if (score >= THRESHOLDS.ACTIVE_CONTEXT) {
    tier = 'active_context';
  } else if (score >= THRESHOLDS.RAG_ONLY) {
    tier = 'rag_only';
  } else {
    tier = 'cold_storage';
  }

  return {
    score: Math.round(score * 1000) / 1000, // 3 decimal places
    tier,
    breakdown: {
      C: Math.round(C * 1000) / 1000,
      U: Math.round(U * 1000) / 1000,
      R: Math.round(R * 1000) / 1000,
      A: Math.round(A * 1000) / 1000,
      baseScore: Math.round(baseScore * 1000) / 1000,
      M_type,
      M_active: Math.round(M_active * 1000) / 1000,
    },
  };
}

/**
 * Compute recency decay R = e^(-λt) where t is days since last activity.
 * Uses the more recent of lastUsedAt or lastModifiedAt.
 *
 * @param {string|null} lastUsedAt - ISO timestamp
 * @param {string|null} lastModifiedAt - ISO timestamp
 * @returns {number} Decay value (0.0–1.0)
 */
function computeRecencyDecay(lastUsedAt, lastModifiedAt) {
  const now = Date.now();
  const timestamps = [];

  if (lastUsedAt) timestamps.push(new Date(lastUsedAt).getTime());
  if (lastModifiedAt) timestamps.push(new Date(lastModifiedAt).getTime());

  if (timestamps.length === 0) return 0.1; // No activity = very low recency

  const mostRecent = Math.max(...timestamps);
  const daysSinceLast = (now - mostRecent) / (1000 * 60 * 60 * 24);

  return Math.exp(-DECAY_LAMBDA * daysSinceLast);
}

/**
 * Compute task alignment using keyword overlap.
 * This is a simple keyword-based similarity — no embeddings needed for MVP.
 * 
 * @param {string} documentContent - Document text or summary
 * @param {string} taskDescription - Active task/goal description
 * @returns {number} Alignment score (0.0–1.0)
 */
export function computeKeywordAlignment(documentContent, taskDescription) {
  if (!documentContent || !taskDescription) return 0.5; // neutral default

  const docWords = extractKeywords(documentContent);
  const taskWords = extractKeywords(taskDescription);

  if (docWords.size === 0 || taskWords.size === 0) return 0.5;

  // Jaccard-like similarity
  let overlap = 0;
  for (const word of docWords) {
    if (taskWords.has(word)) overlap++;
  }

  const similarity = overlap / Math.max(1, Math.min(docWords.size, taskWords.size));
  return Math.min(1.0, similarity * 2); // Scale up since exact keyword overlap is rare
}

/**
 * Extract meaningful keywords from text.
 * Filters stop words and very short tokens.
 * @param {string} text
 * @returns {Set<string>}
 */
function extractKeywords(text) {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'shall', 'can', 'this', 'that',
    'these', 'those', 'it', 'its', 'not', 'no', 'as', 'if', 'then',
    'than', 'when', 'while', 'so', 'up', 'out', 'all', 'each', 'every',
    'both', 'few', 'more', 'most', 'other', 'some', 'such', 'into',
  ]);

  const words = text.toLowerCase().replace(/[^a-z0-9\s-_]/g, ' ').split(/\s+/);
  const keywords = new Set();

  for (const word of words) {
    if (word.length >= 3 && !stopWords.has(word)) {
      keywords.add(word);
    }
  }

  return keywords;
}

/**
 * Batch-score multiple files and return them sorted by score descending.
 *
 * @param {string} projectId
 * @param {Array<object>} files - Array of file score objects from learning-store
 * @param {string} [taskDescription] - Current task/goal for alignment scoring
 * @returns {Promise<Array<{ filePath: string, score: number, tier: string }>>}
 */
export async function batchScore(projectId, files, taskDescription = '') {
  const scored = await Promise.all(
    files.map(async (file) => {
      let taskAlignment = 0.5;
      if (taskDescription) {
        const content = await getProjectFileContent(projectId, file.file_path);
        if (content && content !== file.file_path) {
          taskAlignment = await computeSemanticAlignment(
            projectId,
            `file:${file.file_path}`,
            'file',
            content,
            taskDescription
          );
        }
      }

      const result = computeScore({
        explicitConfidence: file.explicit_confidence,
        usageCount: file.usage_count,
        lastUsedAt: file.last_used_at,
        lastModifiedAt: file.last_modified_at,
        activeBoost: file.active_boost || 0,
        taskAlignment,
      });

      return {
        filePath: file.file_path,
        ...result,
      };
    })
  );

  return scored.sort((a, b) => b.score - a.score);
}

/**
 * Filter files by score tier.
 *
 * @param {Array<{ score: number }>} scoredFiles
 * @param {string} tier - 'active_context' | 'rag_only' | 'cold_storage'
 * @returns {Array}
 */
export function filterByTier(scoredFiles, tier) {
  switch (tier) {
    case 'active_context':
      return scoredFiles.filter(f => f.score >= THRESHOLDS.ACTIVE_CONTEXT);
    case 'rag_only':
      return scoredFiles.filter(f => f.score >= THRESHOLDS.RAG_ONLY && f.score < THRESHOLDS.ACTIVE_CONTEXT);
    case 'cold_storage':
      return scoredFiles.filter(f => f.score < THRESHOLDS.RAG_ONLY);
    default:
      return scoredFiles;
  }
}
