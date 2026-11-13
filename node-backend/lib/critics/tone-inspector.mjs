/**
 * tone-inspector.mjs
 * Brand Voice, Tone & Nomenclature Auditor mini-agent for artifact quality auditing.
 * Verifies compliance with project vocabulary, avoided keywords, writing style, and strips clichés.
 */

import { randomUUID } from 'node:crypto';
import { parseFindingsJson } from './devils-pm.mjs';

export const COMMON_AI_CLICHES = [
  { term: 'seamless integration', replacement: 'direct API integration' },
  { term: 'seamlessly', replacement: 'directly' },
  { term: 'game-changing', replacement: 'high-impact' },
  { term: 'game changer', replacement: 'key differentiator' },
  { term: 'delve into', replacement: 'examine' },
  { term: 'testament to', replacement: 'evidence of' },
  { term: 'plethora of', replacement: 'range of' },
  { term: 'revolutionize', replacement: 'modernize' },
  { term: 'supercharge', replacement: 'accelerate' },
  { term: 'tapestry', replacement: 'architecture' },
];

export const TONE_INSPECTOR_SYSTEM_PROMPT = `You are a Brand Voice & Nomenclature Auditor ("The Tone & Brand Inspector").
Your mission is to audit draft specifications against writing guidelines, domain vocabulary, and forbidden terms:
1. Avoided Terms: Cross-reference text against forbidden terms and banned marketing buzzwords.
2. AI Clichés: Flag empty marketing hype (e.g., "seamless integration", "game-changing", "supercharge").
3. Domain Terminology: Ensure preferred domain nouns are used consistently instead of generic alternatives.
4. Tone & Persona: Ensure clear, concise, active-voice engineering prose without filler words.

For each issue found, provide a structured finding with:
- severity: "critical" (violation of strict project-banned term) or "suggestion" (cliché reduction, tone refinement).
- title: Short actionable title.
- description: Why this phrase violates brand guidelines or introduces ambiguity.
- quote: The exact offending phrase.
- suggestedFix: Crisp replacement text preserving technical accuracy.
- targetSection: Name of the section or header where this quote appears.

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
If the document tone is fully compliant, return an empty array: []`;

/**
 * Heuristic/rule-based scanner for Tone Inspector.
 * @param {string} content
 * @param {object} context
 * @returns {Array<object>}
 */
export function runToneInspectorHeuristics(content = '', context = {}) {
  const findings = [];
  if (!content || typeof content !== 'string') return findings;

  const avoidedKeywords = Array.isArray(context.avoidedKeywords)
    ? context.avoidedKeywords
    : Array.isArray(context.avoided_keywords)
      ? context.avoided_keywords
      : [];

  const domainKeywords = Array.isArray(context.domainKeywords)
    ? context.domainKeywords
    : Array.isArray(context.domain_keywords)
      ? context.domain_keywords
      : [];

  // 1. Check explicit project-level avoided keywords (Critical severity)
  for (const avoided of avoidedKeywords) {
    if (!avoided || typeof avoided !== 'string') continue;
    const cleanTerm = avoided.trim();
    if (!cleanTerm) continue;

    const regex = new RegExp(`\\b${escapeRegExp(cleanTerm)}\\b`, 'i');
    const match = regex.exec(content);
    if (match) {
      findings.push({
        id: `crit-tone-${randomUUID().slice(0, 8)}`,
        critic: 'tone_inspector',
        severity: 'critical',
        title: `Forbidden Term: "${match[0]}"`,
        description: `The term "${match[0]}" is explicitly forbidden by project brand and style guidelines.`,
        quote: match[0],
        suggestedFix: `[Replace "${match[0]}" with approved domain term]`,
        targetSection: 'Tone & Style',
      });
    }
  }

  // 2. Check common AI clichés (Suggestion severity)
  for (const cliché of COMMON_AI_CLICHES) {
    const regex = new RegExp(`\\b${escapeRegExp(cliché.term)}\\b`, 'i');
    const match = regex.exec(content);
    if (match) {
      findings.push({
        id: `crit-tone-${randomUUID().slice(0, 8)}`,
        critic: 'tone_inspector',
        severity: 'suggestion',
        title: `AI Cliché / Marketing Buzzword: "${match[0]}"`,
        description: `Phrases like "${match[0]}" reduce technical precision and read as AI filler.`,
        quote: match[0],
        suggestedFix: cliché.replacement,
        targetSection: 'Tone & Style',
      });
    }
  }

  return findings;
}

/**
 * Escapes regex special characters.
 * @param {string} str
 * @returns {string}
 */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Runs Tone Inspector critic audit.
 * @param {string} content
 * @param {object} context
 * @param {object} [aiProvider]
 * @returns {Promise<Array<object>>}
 */
export async function runToneInspectorCritic(content, context = {}, aiProvider = null) {
  if (!content || typeof content !== 'string') return [];

  // 1. Run immediate rule checks
  const ruleFindings = runToneInspectorHeuristics(content, context);

  // 2. If AI is available and content is long, run LLM audit to detect nuanced tone issues
  if (aiProvider && typeof aiProvider.chat === 'function') {
    try {
      const prompt = `Review the following document artifact for tone, clarity, and keyword compliance.

Avoided Keywords: ${(context.avoidedKeywords || []).join(', ') || 'None specified'}
Domain Keywords: ${(context.domainKeywords || []).join(', ') || 'None specified'}
Writing Persona: ${context.writingStyle || 'Concise, rigorous product engineering specification'}

Document Content:
"""
${content.slice(0, 15000)}
"""`;

      const response = await aiProvider.chat({
        messages: [{ role: 'user', content: prompt }],
        system_prompt: TONE_INSPECTOR_SYSTEM_PROMPT,
        options: { temperature: 0.1 },
      });

      const responseText = response?.content || '';
      const aiFindings = parseFindingsJson(responseText, 'tone_inspector');
      
      // Deduplicate findings by quote/title
      const existingQuotes = new Set(ruleFindings.map(f => f.quote?.toLowerCase()));
      for (const finding of aiFindings) {
        if (!finding.quote || !existingQuotes.has(finding.quote.toLowerCase())) {
          ruleFindings.push(finding);
        }
      }
    } catch (err) {
      console.warn('[ToneInspectorCritic] AI audit encountered error, using rule findings:', err.message);
    }
  }

  return ruleFindings;
}
