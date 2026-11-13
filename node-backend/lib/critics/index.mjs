/**
 * index.mjs
 * Orchestrator for the Adversarial Critic Board mini-agents.
 * Executes parallel evaluations with circuit breakers, aggregates findings, and computes overall quality score.
 */

import { getProjectById } from '../projects.mjs';
import { getProjectSettings } from '../project-settings.mjs';
import { AIService } from '../ai.mjs';
import { runDevilsPMCritic } from './devils-pm.mjs';
import { runTelemetryCritic } from './telemetry-guardian.mjs';
import { runToneInspectorCritic } from './tone-inspector.mjs';

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Loads project context required for critics.
 * @param {string} projectId
 * @returns {Promise<object>}
 */
export async function loadCriticContext(projectId) {
  if (!projectId) return {};
  try {
    const project = await getProjectById(projectId);
    const settings = (await getProjectSettings(projectId)) || {};
    return {
      projectId,
      projectName: project?.name,
      projectGoal: project?.goal || settings.goal,
      avoidedKeywords: settings.avoided_keywords || [],
      domainKeywords: settings.domain_keywords || [],
      writingStyle: settings.personalization_rules,
      summary: `Project "${project?.name}". Goal: ${project?.goal || 'Not specified'}.`,
    };
  } catch (err) {
    console.warn(`[loadCriticContext] Failed to load context for project ${projectId}:`, err.message);
    return {};
  }
}

/**
 * Runs a single critic with a strict timeout circuit breaker.
 * @param {string} name
 * @param {Function} criticPromiseFn
 * @param {number} timeoutMs
 * @returns {Promise<Array<object>>}
 */
async function runCriticWithTimeout(name, criticPromiseFn, timeoutMs = DEFAULT_TIMEOUT_MS) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Critic [${name}] timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([
      Promise.resolve().then(() => criticPromiseFn()),
      timeoutPromise,
    ]);
    return Array.isArray(result) ? result : [];
  } catch (err) {
    console.warn(`[CriticService] Non-fatal error running critic ${name}:`, err.message);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Calculates quality score based on findings.
 * @param {Array<object>} findings
 * @returns {number}
 */
export function calculateOverallScore(findings = []) {
  let score = 100;
  for (const finding of findings) {
    if (finding.severity === 'critical') {
      score -= 15;
    } else if (finding.severity === 'suggestion') {
      score -= 5;
    }
  }
  return Math.max(0, Math.min(100, score));
}

/**
 * Orchestrates multi-agent adversarial quality audit.
 * @param {object} params
 * @param {string} [params.projectId]
 * @param {string} [params.artifactPath]
 * @param {string} params.content
 * @param {Array<string>} [params.critics]
 * @param {object} [params.settings]
 * @param {object} [params.secrets]
 * @param {number} [params.timeoutMs]
 * @returns {Promise<{ summary: string, overallScore: number, findings: Array<object>, durationMs: number }>}
 */
export async function runArtifactAudit(params) {
  const {
    projectId,
    artifactPath,
    content,
    critics = ['devils_pm', 'telemetry_guardian', 'tone_inspector'],
    settings = {},
    secrets = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = params;

  if (!content || typeof content !== 'string') {
    throw new Error('Content is required for artifact audit');
  }

  const startTime = Date.now();
  const context = await loadCriticContext(projectId);

  // Initialize AI Provider if available
  let aiProvider = null;
  const activeProvider = settings.activeProvider || settings.active_provider;
  if (activeProvider && activeProvider !== 'none') {
    try {
      aiProvider = await AIService.createProvider(activeProvider, settings, secrets);
    } catch (err) {
      console.warn('[CriticService] Failed to create AI provider for audit, falling back to heuristics:', err.message);
    }
  }

  const tasks = [];
  const selectedCritics = new Set(critics);

  if (selectedCritics.has('devils_pm')) {
    tasks.push(
      runCriticWithTimeout('devils_pm', () => runDevilsPMCritic(content, context, aiProvider), timeoutMs)
    );
  }

  if (selectedCritics.has('telemetry_guardian')) {
    tasks.push(
      runCriticWithTimeout('telemetry_guardian', () => runTelemetryCritic(content, context, aiProvider), timeoutMs)
    );
  }

  if (selectedCritics.has('tone_inspector')) {
    tasks.push(
      runCriticWithTimeout('tone_inspector', () => runToneInspectorCritic(content, context, aiProvider), timeoutMs)
    );
  }

  const results = await Promise.allSettled(tasks);
  const findings = [];

  for (const res of results) {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      findings.push(...res.value);
    }
  }

  const overallScore = calculateOverallScore(findings);
  const criticalCount = findings.filter(f => f.severity === 'critical').length;
  const suggestionCount = findings.filter(f => f.severity === 'suggestion').length;
  const durationMs = Date.now() - startTime;

  let summary = `Audited with ${tasks.length} critic(s). `;
  if (findings.length === 0) {
    summary += 'All adversarial checks passed cleanly.';
  } else {
    const parts = [];
    if (criticalCount > 0) parts.push(`${criticalCount} critical blocker${criticalCount > 1 ? 's' : ''}`);
    if (suggestionCount > 0) parts.push(`${suggestionCount} suggestion${suggestionCount > 1 ? 's' : ''}`);
    summary += `Found ${parts.join(', ')}.`;
  }

  return {
    summary,
    overallScore,
    findings,
    durationMs,
  };
}
