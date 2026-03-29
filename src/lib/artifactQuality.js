// Quality rules aligned with pragmatic PM documentation practices, focusing on
// problem clarity, measurable outcomes, traceable decisions, and audience-fit.
// Each rule supports heading synonyms and provides actionable guidance.

const RULES = {
  prd: [
    {
      key: 'problem',
      headings: ['## Problem', '## Market Problem', '## The Problem', '## Opportunity'],
      reason: 'Without a clear problem statement, teams risk building solutions that do not address real user pain.',
      suggestion: 'Describe the user pain point, affected segment, and supporting evidence from research, analytics, or support.',
    },
    {
      key: 'personas',
      headings: ['## Personas', '## Target Audience', '## Users', '## Buyer Personas'],
      reason: 'Personas keep the team focused on whose problem is being solved and for whom trade-offs are being made.',
      suggestion: 'Add at least one concrete persona with jobs-to-be-done, pain points, and success criteria.',
    },
    {
      key: 'requirements',
      headings: ['## Requirements', '## Capabilities', '## Scope', '## Scope & Requirements'],
      reason: 'Requirements translate intent into buildable scope and reduce engineering guesswork.',
      suggestion: 'List functional and non-functional requirements, priorities, and any important constraints.',
    },
    {
      key: 'metrics',
      headings: ['## Success Metrics', '## Key Results', '## Metrics', '## Evaluation'],
      reason: 'Success metrics make impact measurable after launch and prevent subjective success definitions.',
      suggestion: 'Define baseline, target, measurement method, and evaluation window.',
    },
  ],
  roadmap: [
    {
      key: 'vision',
      headings: ['## Vision', '## Product Vision'],
      reason: 'A roadmap needs a strategic anchor so near-term work supports long-term direction.',
      suggestion: 'Summarize where the product is going and why this direction matters now.',
    },
    {
      key: 'themes',
      headings: ['## Strategic Themes', '## Themes', '## Key Initiatives'],
      reason: 'Themes group work by outcome and reduce roadmap fragmentation.',
      suggestion: 'Organize initiatives into 2-5 themes connected to customer or business outcomes.',
    },
    {
      key: 'timeline',
      headings: ['## Timeline', '## Phases', '## Milestones'],
      reason: 'A timeline communicates sequencing, dependencies, and planning assumptions.',
      suggestion: 'Add phases/quarters, milestones, and any notable dependencies or risks.',
    },
  ],
  one_pager: [
    {
      key: 'summary',
      headings: ['## Summary', '## Opportunity', '## Background', '## Problem Statement'],
      reason: 'A concise summary helps stakeholders understand the opportunity quickly.',
      suggestion: 'Capture the problem/opportunity, approach, and expected impact in 3-5 bullets.',
    },
    {
      key: 'audience',
      headings: ['## Audience', '## Stakeholders', '## Target Audience'],
      reason: 'Audience context ensures the document is framed for the people who must act on it.',
      suggestion: 'Specify who this one-pager is for and what decision or context they need.',
    },
    {
      key: 'cta',
      headings: ['## Call to Action', '## Next Steps', '## Get Started'],
      reason: 'A clear CTA turns analysis into action instead of leaving the document as a passive artifact.',
      suggestion: 'State the owner, next step, due date, and explicit ask.',
    },
  ],
};

export function detectArtifactKind(fileNameOrPath) {
  const v = String(fileNameOrPath || '').toLowerCase();
  if (v.includes('prd')) return 'prd';
  if (v.includes('roadmap')) return 'roadmap';
  if (v.includes('one-pager') || v.includes('one_pager')) return 'one_pager';
  return null;
}

export function validateArtifactQuality(content, kind) {
  if (!kind) return [];
  const checks = RULES[kind] || [];
  const normalized = String(content || '').toLowerCase();

  const issues = [];
  for (const check of checks) {
    const hasMatch = check.headings.some((h) => normalized.includes(h.toLowerCase()));
    if (!hasMatch) {
      issues.push({
        key: check.key,
        message: `Missing required section. Expected one of: ${check.headings.join(', ')}`,
        reason: check.reason,
        suggestion: check.suggestion,
      });
    }
  }
  return issues;
}
