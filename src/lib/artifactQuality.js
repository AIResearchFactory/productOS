// Quality rules aligned with Pragmatic Institute and John Cutler best practices
// focusing on problem clarity, measurable outcomes, traceable decisions, and audience-appropriate communication.
// Each rule includes an array of accepted headings (synonyms) and actionable suggestions.

const RULES = {
  prd: [
    {
      key: 'problem',
      headings: ['## Problem', '## Market Problem', '## The Problem', '## Opportunity', '## Problem Statement'],
      reason: 'Without a clear problem statement, teams risk building solutions that don\'t address real user pain. This section aligns stakeholders around the "why" before jumping to the "what".',
      suggestion: 'Describe the specific user pain point, the affected user segment, and supporting evidence such as support tickets, user research, or analytics data.',
    },
    {
      key: 'personas',
      headings: ['## Personas', '## Target Audience', '## Users', '## Buyer Personas'],
      reason: 'Focuses the product on the people whose problems you are solving.',
      suggestion: 'Create detailed persona profiles for users and buyers. Articulate what they are trying to achieve and the problems they face.'
    },
    {
      key: 'use_scenarios',
      headings: ['## Use Scenarios', '## User Stories', '## Use Cases'],
      reason: 'Contextualizes the problem and how often it occurs, enabling designers to understand the user\'s perspective without being prescribed a solution.',
      suggestion: 'Follow the format "[Persona] has this [problem] with [frequency]" and tell a brief story about their workflow.'
    },
    {
      key: 'requirements',
      headings: ['## Requirements', '## Capabilities', '## Scope', '## Scope & Requirements', '## User requirements'],
      reason: 'Translates product intent into buildable scope. Without them, engineering must guess at priorities and edge cases, leading to rework.',
      suggestion: 'List functional requirements (what the product does) and non-functional requirements (performance, security, accessibility). Assign priority (P0/P1/P2) to each. Do not prescribe specific technical solutions.'
    },
    {
      key: 'metrics',
      headings: ['## Success Metrics', '## Key Results', '## Metrics', '## Evaluation', '## Key Metrics'],
      reason: 'Success metrics make impact measurable after launch. Without them, you cannot objectively evaluate whether the feature achieved its goals.',
      suggestion: 'For each metric, define: current baseline, target value, measurement method, and evaluation time window.',
    },
  ],
  roadmap: [
    {
      key: 'vision',
      headings: ['## Vision', '## Product Vision'],
      reason: 'A vision statement keeps roadmap decisions aligned to strategic direction and prevents ad-hoc feature accumulation.',
      suggestion: 'Summarize where the product is headed and why it matters now. Connect to company-level strategy or market opportunity.',
    },
    {
      key: 'themes',
      headings: ['## Strategic Themes', '## Themes', '## Key Initiatives'],
      reason: 'Themes help prioritize initiatives by strategy rather than urgency alone. They communicate intent to stakeholders without committing to rigid timelines.',
      suggestion: 'Group roadmap items into 2-5 strategic themes (e.g., "Reduce churn", "Expand to enterprise"). Each theme should map to a business outcome.',
    },
    {
      key: 'timeline',
      headings: ['## Timeline', '## Phases', '## Milestones'],
      reason: 'A timeline makes sequencing and dependencies explicit, helping cross-functional teams plan their work and flag conflicts early.',
      suggestion: 'Include phases or quarters, key milestones, and critical dependencies. Call out known risks to the schedule.',
    },
  ],
  one_pager: [
    {
      key: 'opportunity',
      headings: ['## Opportunity', '## The Problem', '## Problem Statement', '## Background', '## Summary'],
      reason: 'Starting with a clear opportunity or problem establishes the "Why" behind the work.',
      suggestion: 'Briefly define the opportunity. What is the problem we are trying to solve? Why now?'
    },
    {
      key: 'value_impact',
      headings: ['## Value', '## Impact', '## Expected Impact', '## Business Value'],
      reason: 'Helps stakeholders understand the expected return on investment and why this bet is worth taking.',
      suggestion: 'Explain how solving this problem will benefit the customer and the business.'
    },
    {
      key: 'the_bet',
      headings: ['## The Bet', '## Solution', '## Approach', '## Proposed Approach'],
      reason: 'Frames the initiative as an experiment or bet rather than a guaranteed solution, encouraging humility and focus on outcomes.',
      suggestion: 'Describe the solution as a bet. What are the key assumptions and known risks?'
    },
    {
      key: 'success',
      headings: ['## Success Metrics', '## Definition of Success', '## Outcomes'],
      reason: 'Clearly states how you will know you are successful, moving a specific metric or solving a specific customer problem.',
      suggestion: 'List the lagging and leading indicators you will use to measure success.'
    },
    {
      key: 'cta',
      headings: ['## Call to Action', '## Next Steps', '## Get started today', '## Get Started'],
      reason: 'A clear call to action converts analysis into concrete next steps. Without it, documents become informational rather than actionable.',
      suggestion: 'State the owner, due date, and specific decision or action requested.',
    },
  ],
  datasheet: [
    {
      key: 'product_definition',
      headings: ['## Product Definition', '## Overview', '## What is it?'],
      reason: 'Orients the reader to your product and provides context for the rest of the data sheet. Essential for skimming buyers.',
      suggestion: 'Include a brief (two sentences or less) definition that explains what the product is and how it solves the audience\'s high-level problem.'
    },
    {
      key: 'benefits',
      headings: ['## Benefits', '## Key Benefits', '## Why Choose Us?'],
      reason: 'Buyers want to know how the product helps them solve their problems. Summarizing benefits upfront gives readers a reason to continue.',
      suggestion: 'Use a short, bulleted list of 3-4 key benefits utilizing action-oriented verbs.'
    },
    {
      key: 'use_cases',
      headings: ['## Use Cases', '## When to Use', '## Examples'],
      reason: 'Contextualizes the solution and helps prospects identify exactly when they would use the product.',
      suggestion: 'Provide specific scenarios or examples of the product in action.'
    },
    {
      key: 'cta',
      headings: ['## Call to Action', '## Learn More', '## Next Steps', '## Get Started', '## Contact Us'],
      reason: 'Directs the reader to the logical next step in the sales cycle without wasting space on generic information.',
      suggestion: 'Link to a technical white paper, a demo, or a testimonial video to keep the conversation going.'
    }
  ],
  positioning: [
    {
      key: 'target_audience',
      headings: ['## Target Audience', '## Personas', '## Ideal Customer'],
      reason: 'Positioning must be centered around the specific audience you are trying to reach.',
      suggestion: 'Clearly define who the product is for.'
    },
    {
      key: 'the_problem',
      headings: ['## The Problem', '## Market Problem', '## Pain Points'],
      reason: 'Establishes the context of why the target audience needs a solution now.',
      suggestion: 'Describe the core problem or challenge your target audience is facing.'
    },
    {
      key: 'differentiator',
      headings: ['## Differentiator', '## Unique Value', '## Competitive Advantage', '## Why Us?'],
      reason: 'Explains why your product is the best choice among alternatives.',
      suggestion: 'State exactly what makes your product unique compared to alternative solutions.'
    },
    {
      key: 'value_prop',
      headings: ['## Value Proposition', '## Value Prop', '## The Solution'],
      reason: 'Combines the audience, problem, and differentiator into a single, cohesive message.',
      suggestion: 'Summarize the core promise you are making to the customer.'
    }
  ]
};

export function detectArtifactKind(fileNameOrPath) {
  const v = String(fileNameOrPath || '').toLowerCase();
  
  if (v.includes('prd')) return 'prd';
  if (v.includes('roadmap')) return 'roadmap';
  if (v.includes('one-pager') || v.includes('one_pager')) return 'one_pager';
  if (v.includes('datasheet') || v.includes('data-sheet') || v.includes('data_sheet')) return 'datasheet';
  if (v.includes('positioning')) return 'positioning';
  
  return null;
}

export function validateArtifactQuality(content, kind) {
  if (!kind) return [];
  const checks = RULES[kind] || [];
  const normalized = String(content || '').toLowerCase();

  const issues = [];
  for (const check of checks) {
    const hasMatch = check.headings.some(h => normalized.includes(h.toLowerCase()));
    
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
