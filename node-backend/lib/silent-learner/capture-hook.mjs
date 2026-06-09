/**
 * capture-hook.mjs
 * Provider-agnostic event capture for Silent Learner.
 * Hooks into the AgentOrchestrator to capture metadata from all AI interactions.
 * Only captures metadata (files, outcome, provider, timing) — not raw transcripts.
 */

import { createHash } from 'node:crypto';

/**
 * Create a SHA-256 hash of text for deduplication without storing raw content.
 * @param {string} text
 * @returns {string}
 */
function hashText(text) {
  if (!text) return null;
  return 'sha256:' + createHash('sha256').update(text).digest('hex').slice(0, 16);
}

/**
 * Extract file paths mentioned in AI response text.
 * Looks for common code patterns: file paths, import statements, etc.
 * @param {string} text
 * @returns {string[]}
 */
function extractFilesFromText(text) {
  if (!text) return [];
  const files = new Set();

  // Match file paths like src/components/Foo.tsx, ./lib/bar.mjs, etc.
  const pathPattern = /(?:^|\s|["'`(])([a-zA-Z0-9_./-]+\.(?:tsx?|jsx?|mjs|cjs|mts|cts|css|html|json|md|yaml|yml|toml|py|rs|go|sh|sql))\b/g;
  let match;
  while ((match = pathPattern.exec(text)) !== null) {
    const file = match[1].replace(/^\.\//, '');
    if (file.length > 2 && file.length < 200 && !file.startsWith('http')) {
      files.add(file);
    }
  }

  return Array.from(files);
}

/**
 * Classify a task/request description or chat content into a specific type.
 * Evaluates rules in prioritized order.
 * @param {string} text
 * @returns {string}
 */
export function classifyText(text) {
  if (!text) return 'general';
  const lower = text.toLowerCase();

  // 1. Bugs / Issues
  if (/\b(?:fix|bug|error|crash|issue|broken|fail|failure|fault|defect|patch|regression|hotfix)\b/.test(lower)) return 'bugfix';

  // 2. Testing
  if (/\b(?:test|spec|assertion|coverage|e2e|unit|integration|mock|fixture|playwright|jest|vitest|mocha|cypress)\b/.test(lower)) return 'testing';

  // 3. Refactoring / Optimization
  if (/\b(?:refactor|clean|simplif|restructure|optimization|optimize|performance|perf|cleanup|redesign)\b/.test(lower)) return 'refactor';

  // 4. Product Requirements / Specifications (PRD)
  if (/\b(?:prd|specs?|specifications?|requirements?|scope|product\s+requirement|functional\s+spec)\b/.test(lower)) return 'prd';

  // 5. Roadmapping / Planning
  if (/\b(?:roadmaps?|planning|timelines?|milestones?|strategy|initiatives?|gantt|schedules?|vision|mission|alignment|okrs?|goals?)\b/.test(lower)) return 'roadmap';

  // 6. Competitive / Market Research
  if (/\b(?:competit(?:ive|or|ion|ors)|benchmarks?|market(?:place)?|landscape|trends?|pricing|swot|analysts?|gartner|forrester|competitors?|tam|sam|som|positioning)\b/.test(lower)) return 'competitive';

  // 7. KPIs / Metrics / Analytics
  if (/\b(?:kpis?|metrics?|dashboards?|analytics|measures?|tracking|conversions?|retention|funnels?|churn|active\s+users|dau|mau|ltv|cac)\b/.test(lower)) return 'kpi';

  // 8. User Stories / Tasks / Tickets / Backlog
  if (/\b(?:(?:user\s+)?stor(?:y|ies)|acceptance\s+criteria|wireframes?|flows?|personas?|tickets?|epics?|backlog|grooming|prioritiz|rice|moscow|scoring)\b/.test(lower)) return 'user_story';

  // 9. Launch / GTM / Release
  if (/\b(?:launch(?:es)?|releases?|gtm|go-to-market|rollouts?|announcements?|newsletter|marketing|deployment)\b/.test(lower)) return 'launch';

  // 10. User Feedback / Support / Interviews
  if (/\b(?:feedback|interviews?|surveys?|complaints?|nps|customers?|users?|voice\s+of\s+customer|voc|tickets?|requests?|reviews?)\b/.test(lower)) return 'feedback';

  // 11. Feature Implementation
  if (/\b(?:add|implement|create|build|feature|new)\b/.test(lower)) return 'feature';

  // 12. Code review
  if (/\b(?:review|check|audit|inspect)\b/.test(lower)) return 'review';

  // 13. General Research / Exploration
  if (/\b(?:research|explore|investigate|find|search|analyze)\b/.test(lower)) return 'research';

  // 14. Documentation / Docs
  if (/\b(?:document|docs|readme|comment|explain)\b/.test(lower)) return 'documentation';

  // 15. Generation / Drafting
  if (/\b(?:generat|write|draft|compose|summarize)\b/.test(lower)) return 'generation';

  return 'general';
}

/**
 * Classify the task type from messages.
 * Uses simple heuristics based on user message content.
 * @param {Array<{role: string, content: string}>} messages
 * @returns {string}
 */
function classifyTaskType(messages) {
  const userMessages = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
  return classifyText(userMessages);
}


/**
 * Determine the interaction outcome from the orchestrator result.
 * @param {object} result - runAgentLoop result
 * @param {boolean} hasFileChanges - Whether file changes were applied
 * @param {boolean} hasArtifactChanges - Whether artifact changes were applied
 * @returns {string}
 */
function determineOutcome(result, hasFileChanges, hasArtifactChanges) {
  if (!result || !result.content) return 'no_response';
  if (result.metadata?.model_used === 'error') return 'error';
  if (result.metadata?.model_used === 'aborted') return 'aborted';
  if (result.metadata?.model_used === 'none') return 'provider_unavailable';

  if (hasFileChanges && hasArtifactChanges) return 'files_and_artifacts_changed';
  if (hasFileChanges) return 'files_changed';
  if (hasArtifactChanges) return 'artifacts_changed';

  return 'response_generated';
}

/**
 * Build a capture event from an AI interaction.
 * This is the primary interface consumed by the orchestrator hook.
 *
 * @param {object} params
 * @param {string} params.projectId
 * @param {string} params.sessionId - Current chat session ID
 * @param {string} params.provider - Provider type ('claudeCode', 'ollama', etc.)
 * @param {Array<{role: string, content: string}>} params.messages - Chat messages
 * @param {object} params.result - AI response result
 * @param {string[]} [params.fileChanges] - Applied file changes
 * @param {string[]} [params.artifactChanges] - Applied artifact changes
 * @returns {object} Learning event ready for insertion into the store
 */
export function buildCaptureEvent(params) {
  const { projectId, sessionId, provider, messages, result, fileChanges = [], artifactChanges = [] } = params;

  // Hash messages, never store raw
  const lastUserMsg = messages.filter(m => m.role === 'user').pop();
  const promptHash = hashText(lastUserMsg?.content);
  const responseHash = hashText(result?.content);

  // Extract files mentioned in the response
  const filesFromResponse = extractFilesFromText(result?.content);
  const allFilesTouched = [...new Set([...fileChanges, ...filesFromResponse])];

  // Classify task type
  const taskType = classifyTaskType(messages);

  // Determine outcome
  const hasFileChanges = fileChanges.length > 0;
  const hasArtifactChanges = artifactChanges.length > 0;
  const outcome = determineOutcome(result, hasFileChanges, hasArtifactChanges);

  // Build metadata blob (extensible, no raw text)
  const metadata = {
    provider,
    messageCount: messages.length,
    responseLength: result?.content?.length || 0,
    fileChangeCount: fileChanges.length,
    artifactChangeCount: artifactChanges.length,
    tokensIn: result?.metadata?.tokens_in || 0,
    tokensOut: result?.metadata?.tokens_out || 0,
    model: result?.metadata?.model_used || null,
  };

  return {
    session_id: sessionId || 'default',
    source: provider || 'unknown',
    task_type: taskType,
    prompt_hash: promptHash,
    response_hash: responseHash,
    accepted_changes: hasFileChanges || hasArtifactChanges,
    files_touched: allFilesTouched,
    outcome,
    data_class: 'safe', // Will be overwritten by privacy filter
    metadata,
  };
}

/**
 * Check if an event is worth capturing (has enough signal).
 * Low-signal events are discarded.
 * @param {object} event
 * @returns {boolean}
 */
export function isHighSignal(event) {
  // Always capture when changes were applied
  if (event.accepted_changes) return true;

  // Capture if useful outcomes
  const usefulOutcomes = ['files_changed', 'artifacts_changed', 'files_and_artifacts_changed', 'response_generated'];
  if (!usefulOutcomes.includes(event.outcome)) return false;

  // Skip very short interactions (likely errors or retries)
  if (event.metadata?.responseLength < 50) return false;

  return true;
}
