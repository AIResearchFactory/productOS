/**
 * devils-pm.mjs
 * Adversarial Principal Product Manager mini-agent for artifact quality auditing.
 * Scans for scope creep, missing edge cases, negative flows, unstated assumptions, and vague criteria.
 */

import { randomUUID } from 'node:crypto';

export const DEVILS_PM_SYSTEM_PROMPT = `You are an adversarial, hyper-rigorous Principal Product Manager ("The Devil's PM").
Your mission is to tear down draft product specifications (PRDs, Roadmaps, User Stories, Architecture Specs) to find:
1. Unstated technical and operational assumptions.
2. Missing edge cases, failure states, negative flows, and rate limit / backoff gaps.
3. Concurrency traps, race conditions, or unhandled offline/reconnect behaviors.
4. Vague non-functional criteria (e.g. "fast", "intuitive", "bulletproof", "seamless", "scalable") lacking measurable SLAs.
5. Unbounded scope creep or hidden cross-service dependencies.

For each issue found, provide a structured finding with:
- severity: "critical" (showstoppers, security/data loss risks, missing error recovery) or "suggestion" (clarifications, tighter acceptance criteria).
- title: Short actionable title.
- description: Why this creates risk for engineering, design, or the user.
- quote: The exact substring or sentence from the document that needs remediation.
- suggestedFix: Concrete, drop-in replacement markdown text.
- targetSection: Name of the section or header where this fix belongs.

Respond ONLY with a valid JSON array of findings:
[
  {
    "severity": "critical" | "suggestion",
    "title": "...",
    "description": "...",
    "quote": "...",
    "suggestedFix": "...",
    "targetSection": "..."
  }
]
If the document is rock solid with no gaps, return an empty array: []`;

/**
 * Heuristic/rule-based scanner for Devil's PM when LLM is unavailable or for instant feedback.
 * @param {string} content
 * @returns {Array<object>}
 */
export function runDevilsPMHeuristics(content = '') {
  const findings = [];
  const lower = content.toLowerCase();

  // 1. Check for vague performance terms
  const vagueTerms = [
    { term: 'fast', suggestion: 'response time < 200ms at p95' },
    { term: 'scalable', suggestion: 'support 10k concurrent active connections with linear CPU scaling' },
    { term: 'intuitive', suggestion: '80% first-time completion without docs/onboarding prompt' },
    { term: 'real-time', suggestion: 'SSE / WebSocket message latency < 100ms' },
  ];

  for (const item of vagueTerms) {
    const regex = new RegExp(`\\b${item.term}\\b`, 'i');
    const match = regex.exec(content);
    if (match) {
      findings.push({
        id: `crit-devils-${randomUUID().slice(0, 8)}`,
        critic: 'devils_pm',
        severity: 'suggestion',
        title: `Vague Non-Functional Term: "${item.term}"`,
        description: `Adjective "${item.term}" is ambiguous for engineering implementation and QA validation.`,
        quote: match[0],
        suggestedFix: item.suggestion,
        targetSection: 'Non-Functional Requirements',
      });
    }
  }

  // 2. Check for missing error handling / rate limiting in webhook/API/push contexts
  if ((lower.includes('webhook') || lower.includes('alert') || lower.includes('notification') || lower.includes('push')) &&
      !lower.includes('rate limit') && !lower.includes('retry') && !lower.includes('backoff') && !lower.includes('dead-letter')) {
    findings.push({
      id: `crit-devils-${randomUUID().slice(0, 8)}`,
      critic: 'devils_pm',
      severity: 'critical',
      title: 'Missing Rate Limit & Dead-Letter Queue Recovery',
      description: 'The spec proposes event delivery or webhook dispatching without handling HTTP 429 backoff, retry caps, or dead-letter queue routing.',
      quote: content.includes('alert') ? 'alerts are pushed' : 'events are dispatched',
      suggestedFix: 'Implement retry with exponential backoff up to 3 attempts (1s, 5s, 15s). Route unrecoverable deliveries to dead-letter queue with alert to telemetry.',
      targetSection: 'Error Handling & Reliability',
    });
  }

  // 3. Check for missing rollback criteria
  if (lower.includes('migration') || lower.includes('database') || lower.includes('schema')) {
    if (!lower.includes('rollback') && !lower.includes('downgrade') && !lower.includes('revert')) {
      findings.push({
        id: `crit-devils-${randomUUID().slice(0, 8)}`,
        critic: 'devils_pm',
        severity: 'critical',
        title: 'Missing Database Migration Rollback Plan',
        description: 'Database or schema modifications are specified without an explicit backward-compatible rollback procedure.',
        quote: 'database migration',
        suggestedFix: 'All schema modifications must be dual-write compatible for 1 release cycle with documented zero-downtime rollback scripts.',
        targetSection: 'Deployment & Migration Strategy',
      });
    }
  }

  return findings;
}

/**
 * Runs The Devil's PM critic audit.
 * @param {string} content
 * @param {object} context
 * @param {object} [aiProvider]
 * @returns {Promise<Array<object>>}
 */
export async function runDevilsPMCritic(content, context = {}, aiProvider = null) {
  if (!content || typeof content !== 'string') return [];

  if (aiProvider && typeof aiProvider.chat === 'function') {
    try {
      const prompt = `Review the following document artifact rigorously. Flag unstated assumptions, missing edge cases, and vague requirements.

Project Goal: ${context.projectGoal || 'Not specified'}
Project Context: ${context.summary || ''}

Document Content:
"""
${content.slice(0, 15000)}
"""`;

      const response = await aiProvider.chat({
        messages: [{ role: 'user', content: prompt }],
        system_prompt: DEVILS_PM_SYSTEM_PROMPT,
        options: { temperature: 0.1 },
      });

      const responseText = response?.content || '';
      const parsed = parseFindingsJson(responseText, 'devils_pm');
      if (parsed.length > 0) {
        return parsed;
      }
    } catch (err) {
      console.warn('[DevilsPMCritic] AI audit encountered error, falling back to heuristics:', err.message);
    }
  }

  return runDevilsPMHeuristics(content);
}

/**
 * Parses JSON response from mini-agent LLM output.
 * @param {string} text
 * @param {string} criticType
 * @returns {Array<object>}
 */
export function parseFindingsJson(text, criticType = 'devils_pm') {
  if (!text || typeof text !== 'string') return [];

  try {
    const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonMatch) {
      const rawArr = JSON.parse(jsonMatch[0]);
      if (Array.isArray(rawArr)) {
        return rawArr.map(item => ({
          id: item.id || `crit-${criticType}-${randomUUID().slice(0, 8)}`,
          critic: criticType,
          severity: item.severity === 'critical' ? 'critical' : 'suggestion',
          title: String(item.title || 'Identified Quality Gap'),
          description: String(item.description || ''),
          quote: item.quote ? String(item.quote) : undefined,
          suggestedFix: String(item.suggestedFix || ''),
          targetSection: item.targetSection ? String(item.targetSection) : undefined,
        }));
      }
    }
  } catch (err) {
    console.warn(`[parseFindingsJson] Failed to parse JSON for ${criticType}:`, err.message);
  }
  return [];
}
