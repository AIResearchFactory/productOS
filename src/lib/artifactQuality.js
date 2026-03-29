// Inspired by pragmatic PM documentation practices (problem clarity, measurable outcomes,
// traceable decisions, and audience-appropriate communication).
const RULES = {
  prd: [
    {
      key: 'problem',
      heading: '## Problem',
      reason: 'A clear problem statement aligns teams around why this work matters.',
      suggestion: 'Describe user pain, affected segment, and evidence (tickets/research).',
    },
    {
      key: 'goals',
      heading: '## Goals',
      reason: 'Goals define expected outcomes and avoid solution-only discussions.',
      suggestion: 'Add 2-4 outcome goals with scope boundaries and assumptions.',
    },
    {
      key: 'requirements',
      heading: '## Requirements',
      reason: 'Requirements translate intent into buildable scope for engineering/design.',
      suggestion: 'List functional and non-functional requirements with priorities.',
    },
    {
      key: 'metrics',
      heading: '## Success Metrics',
      reason: 'Success metrics make impact measurable after launch.',
      suggestion: 'Define baseline, target, and measurement method/date window.',
    },
  ],
  roadmap: [
    {
      key: 'vision',
      heading: '## Vision',
      reason: 'Vision keeps roadmap decisions aligned to strategic direction.',
      suggestion: 'Summarize destination and why it matters now.',
    },
    {
      key: 'themes',
      heading: '## Strategic Themes',
      reason: 'Themes help prioritize initiatives by strategy rather than urgency alone.',
      suggestion: 'Group roadmap items into 2-5 strategic themes.',
    },
    {
      key: 'timeline',
      heading: '## Timeline',
      reason: 'A timeline makes sequencing and dependencies explicit for stakeholders.',
      suggestion: 'Include phases/quarters, milestones, and key dependencies.',
    },
  ],
  one_pager: [
    {
      key: 'summary',
      heading: '## Summary',
      reason: 'A concise summary allows fast alignment and decision-making.',
      suggestion: 'Capture the opportunity, approach, and expected impact in 3-5 bullets.',
    },
    {
      key: 'audience',
      heading: '## Audience',
      reason: 'Audience context ensures messaging and scope match stakeholder needs.',
      suggestion: 'Specify primary readers and decisions expected from each.',
    },
    {
      key: 'cta',
      heading: '## Call to Action',
      reason: 'A clear CTA converts analysis into concrete next steps.',
      suggestion: 'State owner, due date, and decision request explicitly.',
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
  const normalized = String(content || '');

  const issues = [];
  for (const check of checks) {
    if (!normalized.includes(check.heading)) {
      issues.push({
        key: check.key,
        message: `Missing required section: ${check.heading}`,
        reason: check.reason,
        suggestion: check.suggestion,
      });
    }
  }
  return issues;
}
