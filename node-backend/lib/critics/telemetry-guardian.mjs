/**
 * telemetry-guardian.mjs
 * Staff Product Analytics Lead mini-agent for artifact quality auditing.
 * Verifies presence of Primary KPIs, Guardrail Metrics, Event Tracking schemas, and Rollback triggers.
 */

import { randomUUID } from 'node:crypto';
import { parseFindingsJson } from './devils-pm.mjs';

export const TELEMETRY_GUARDIAN_SYSTEM_PROMPT = `You are a Staff Product Analytics Lead ("The Telemetry & Metrics Guardian").
Your mission is to audit draft product specifications to ensure complete instrumentation, accountability, and observability:
1. Primary KPI: Is there a measurable, quantifiable North Star metric with a baseline and target?
2. Guardrail Metrics: Are there counter-metrics specified to ensure growth doesn't sacrifice latency, system stability, user trust, or support volume?
3. Event Tracking Instrumentation: Are PostHog/Segment/Mixpanel tracking events enumerated with descriptive names (e.g. "feature.action_completed") and required properties?
4. Rollback / Circuit Breaker Thresholds: Is there an explicit degradation threshold (e.g., error rate > 1%, p95 latency > 500ms) that triggers an automated or manual rollback?

For each issue found, provide a structured finding with:
- severity: "critical" (completely missing KPIs, zero event tracking in an interactive feature) or "suggestion" (missing event property, unquantified target).
- title: Short actionable title.
- description: Why this makes it impossible to validate success or diagnose regressions.
- quote: The exact substring or section where instrumentation is incomplete.
- suggestedFix: Concrete, drop-in replacement markdown text (e.g. a telemetry table or KPI block).
- targetSection: Name of the section or header where this belongs (e.g. "Telemetry & Metrics").

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
If the document has thorough instrumentation and metrics, return an empty array: []`;

/**
 * Heuristic/rule-based scanner for Telemetry Guardian when LLM is unavailable or for instant feedback.
 * @param {string} content
 * @returns {Array<object>}
 */
export function runTelemetryGuardianHeuristics(content = '') {
  const findings = [];
  const lower = content.toLowerCase();

  // 1. Check for missing Primary KPI / Success Metrics
  const hasKpi = lower.includes('kpi') || lower.includes('success metric') || lower.includes('north star') || lower.includes('primary metric');
  if (!hasKpi) {
    findings.push({
      id: `crit-telem-${randomUUID().slice(0, 8)}`,
      critic: 'telemetry_guardian',
      severity: 'critical',
      title: 'Missing Measurable Success Metrics & KPIs',
      description: 'Document lacks a designated Primary KPI with quantifiable baseline and success targets.',
      quote: content.slice(0, 80).trim(),
      suggestedFix: `## Success Metrics & KPIs
| Metric | Baseline | Target | Measurement Window |
| :--- | :--- | :--- | :--- |
| **Primary KPI** (e.g. Feature Adoption Rate) | 0% | $\\ge 35\\%$ active weekly users | 30 days post-launch |
| **Time-to-Value (TTV)** | N/A | $\\le 90\\text{s}$ first session | Ongoing |`,
      targetSection: 'Success Metrics & KPIs',
    });
  }

  // 2. Check for missing event-level tracking instrumentation
  const hasEventTracking = lower.includes('event') || lower.includes('telemetry') || lower.includes('posthog') || lower.includes('segment') || lower.includes('analytics');
  if (!hasEventTracking) {
    findings.push({
      id: `crit-telem-${randomUUID().slice(0, 8)}`,
      critic: 'telemetry_guardian',
      severity: 'critical',
      title: 'Missing Event Tracking Schema',
      description: 'Interactive user flows are defined without explicit event instrumentation definitions.',
      quote: content.slice(0, 80).trim(),
      suggestedFix: `## Event Tracking Schema
| Event Name | Trigger Point | Payload Properties |
| :--- | :--- | :--- |
| \`feature.opened\` | User accesses entry point | \`source\`, \`projectId\` |
| \`feature.action_completed\` | User finishes primary workflow | \`durationMs\`, \`mode\`, \`itemCount\` |
| \`feature.failed\` | Error encountered | \`errorCode\`, \`step\` |`,
      targetSection: 'Telemetry & Analytics',
    });
  } else if (!lower.includes('guardrail') && !lower.includes('counter-metric') && !lower.includes('error rate')) {
    // Has some telemetry, but missing guardrail metrics
    findings.push({
      id: `crit-telem-${randomUUID().slice(0, 8)}`,
      critic: 'telemetry_guardian',
      severity: 'suggestion',
      title: 'Missing Guardrail Metrics & Health Thresholds',
      description: 'Telemetry specifies positive engagement metrics but omits guardrail metrics (e.g. error rate, p95 latency, opt-out rate).',
      quote: 'telemetry',
      suggestedFix: `### Guardrail Metrics & Circuit Breakers
- **Error Budget**: Max allowable 5xx rate $< 0.1\\%$ over 5-minute rolling window.
- **Performance SLA**: p95 response time $< 300\\text{ms}$.
- **Rollback Trigger**: Uncaught client exceptions $> 1\\%$ triggers automated flag kill-switch.`,
      targetSection: 'Telemetry & Analytics',
    });
  }

  return findings;
}

/**
 * Runs the Telemetry Guardian critic audit.
 * @param {string} content
 * @param {object} context
 * @param {object} [aiProvider]
 * @returns {Promise<Array<object>>}
 */
export async function runTelemetryCritic(content, context = {}, aiProvider = null) {
  if (!content || typeof content !== 'string') return [];

  if (aiProvider && typeof aiProvider.chat === 'function') {
    try {
      const prompt = `Review the following document artifact for analytics, KPIs, event tracking, and guardrail metrics completeness.

Project Goal: ${context.projectGoal || 'Not specified'}
Project Context: ${context.summary || ''}

Document Content:
"""
${content.slice(0, 15000)}
"""`;

      const response = await aiProvider.chat({
        messages: [{ role: 'user', content: prompt }],
        system_prompt: TELEMETRY_GUARDIAN_SYSTEM_PROMPT,
        options: { temperature: 0.1 },
      });

      const responseText = response?.content || '';
      const parsed = parseFindingsJson(responseText, 'telemetry_guardian');
      if (parsed.length > 0) {
        return parsed;
      }
    } catch (err) {
      console.warn('[TelemetryCritic] AI audit encountered error, falling back to heuristics:', err.message);
    }
  }

  return runTelemetryGuardianHeuristics(content);
}
