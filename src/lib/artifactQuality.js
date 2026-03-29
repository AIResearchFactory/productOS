// Quality rules aligned with Pragmatic Institute best practices
// (https://www.pragmaticinstitute.com/) — focusing on problem clarity,
// measurable outcomes, traceable decisions, and audience-appropriate communication.
// Each rule includes a reason (why this section matters) and a suggestion
// (what to add or improve if the section is missing).
const RULES = {
  prd: [
    {
      key: 'problem',
      heading: '## Problem',
      reason:
        'Without a clear problem statement, teams risk building solutions that don\'t address real user pain. This section aligns stakeholders around the "why" before jumping to the "what".',
      suggestion:
        'Describe the specific user pain point, the affected user segment, and supporting evidence such as support tickets, user research, or analytics data.',
    },
    {
      key: 'goals',
      heading: '## Goals',
      reason:
        'Goals define the expected outcomes and prevent solution-only discussions. They give engineering and design a measurable target to design against.',
      suggestion:
        'Add 2-4 outcome-oriented goals. Include scope boundaries (what is NOT in scope) and key assumptions that could invalidate the approach.',
    },
    {
      key: 'requirements',
      heading: '## Requirements',
      reason:
        'Requirements translate product intent into buildable scope. Without them, engineering must guess at priorities and edge cases, leading to rework.',
      suggestion:
        'List functional requirements (what the product does) and non-functional requirements (performance, security, accessibility). Assign priority (P0/P1/P2) to each.',
    },
    {
      key: 'metrics',
      heading: '## Success Metrics',
      reason:
        'Success metrics make impact measurable after launch. Without them, you cannot objectively evaluate whether the feature achieved its goals.',
      suggestion:
        'For each metric, define: current baseline, target value, measurement method, and evaluation time window (e.g., "30 days post-launch").',
    },
  ],
  roadmap: [
    {
      key: 'vision',
      heading: '## Vision',
      reason:
        'A vision statement keeps roadmap decisions aligned to strategic direction and prevents ad-hoc feature accumulation.',
      suggestion:
        'Summarize where the product is headed and why it matters now. Connect to company-level strategy or market opportunity.',
    },
    {
      key: 'themes',
      heading: '## Strategic Themes',
      reason:
        'Themes help prioritize initiatives by strategy rather than urgency alone. They communicate intent to stakeholders without committing to rigid timelines.',
      suggestion:
        'Group roadmap items into 2-5 strategic themes (e.g., "Reduce churn", "Expand to enterprise"). Each theme should map to a business outcome.',
    },
    {
      key: 'timeline',
      heading: '## Timeline',
      reason:
        'A timeline makes sequencing and dependencies explicit, helping cross-functional teams plan their work and flag conflicts early.',
      suggestion:
        'Include phases or quarters, key milestones, and critical dependencies. Call out known risks to the schedule.',
    },
  ],
  one_pager: [
    {
      key: 'summary',
      heading: '## Summary',
      reason:
        'A concise summary enables fast alignment and decision-making among busy stakeholders who may not read the full document.',
      suggestion:
        'Capture the opportunity, proposed approach, and expected impact in 3-5 bullets. Keep it under 150 words.',
    },
    {
      key: 'audience',
      heading: '## Audience',
      reason:
        'Audience context ensures the document\'s messaging and level of detail match stakeholder needs and expectations.',
      suggestion:
        'Specify primary readers (e.g., VP Engineering, Design Lead) and the decision or action expected from each.',
    },
    {
      key: 'cta',
      heading: '## Call to Action',
      reason:
        'A clear call to action converts analysis into concrete next steps. Without it, documents become informational rather than actionable.',
      suggestion:
        'State the owner, due date, and specific decision request explicitly (e.g., "Approve scope by March 15").',
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
