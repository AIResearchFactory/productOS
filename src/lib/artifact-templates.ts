/**
 * Default markdown templates for Product Management artifacts
 */

export const DEFAULT_TEMPLATES: Record<string, string> = {
  roadmap: `# {{title}}

## Vision
Detailed vision for the product's mid-to-long term future.

## Strategic Goals (SMART)
- **Goal 1**: Describe objective and target date.
- **Goal 2**: Describe objective and target date.

## Key Themes & Initiatives
### [Theme A]
- **Initiative 1**: Brief description and expected outcome.
- **Initiative 2**: Brief description and expected outcome.

### [Theme B]
- **Initiative 3**: Brief description and expected outcome.

## Timeline / Phases
- **Now**: High-certainty items currently in development.
- **Next**: Planned items with high priority.
- **Later**: Future explorations and backlog items.

## Success Metrics
How will we measure the success of this roadmap?`,

  product_vision: `# {{title}}

## The Problem
What is the core problem we are solving?

## Target Audience
Who are we building this for?

## Vision Statement
A concise, inspiring statement of the product's ultimate goal.

## Key Differentiators
What sets this apart from existing solutions?

## Expected Outcomes
What does the world look like when this vision is realized?`,

  one_pager: `# {{title}}

## Overview
A brief summary of the proposal.

## Problem Statement
The specific customer pain point we are addressing.

## Proposed Solution
High-level description of how we solve it.

## Key Benefits
- **Benefit 1**: Description.
- **Benefit 2**: Description.

## Success Criteria
What does success look like?

## Timeline & Milestones
Key dates for implementation.`,

  prd: `# {{title}}

## Overview
Context and background for this product/feature.

## Goals & Objectives
What are we trying to achieve?

## Target Audience
Who is this for?

## User Stories
- **User Story 1**: As a [user], I want [action] so that [value].
- **User Story 2**: ...

## Functional Requirements
Detailed list of must-have functionalities.

## Non-Functional Requirements
Performance, security, scalability, etc.

## Designs & Mockups
[Link or description of visual designs]

## Success Metrics (KPIs)
How will we track performance?

## Out of Scope
What we are NOT doing in this version.`,

  initiative: `# {{title}}

## Objective
Primary goal of this initiative.

## Strategic Context
How does this align with the overall product roadmap?

## Desired Outcomes
Measurable results expected from this effort.

## High-Level Requirements
Key features or changes needed.

## Priority & WSJF
Weighting of this initiative relative to others.`,

  competitive_research: `# {{title}}

## Objectives
Why are we conducting this analysis?

## Competitors
### [Competitor A]
- **Strengths**: ...
- **Weaknesses**: ...
- **Pricing**: ...

### [Competitor B]
- **Strengths**: ...
- **Weaknesses**: ...

## SWOT Analysis
- **Strengths**: [Our strengths]
- **Weaknesses**: [Our weaknesses]
- **Opportunities**: [Market gaps]
- **Threats**: [External risks]

## Actionable Insights
Recommendations based on this research.`,

  user_story: `# {{title}}

## Story
As a **[user type]**, I want **[to perform an action]** so that **[I achieve a value/benefit]**.

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Notes & Constraints
Any technical or design limitations.`,

  insight: `# {{title}}

## Observation
What data or feedback was observed?

## Source
Where did this information come from? (e.g., User Interview, Analytics, CS Ticket)

## Meaning & Impact
What does this mean for the product? How significant is it?

## Recommendation
Proposed action items based on this insight.`,

  presentation: `# {{title}}

## Presentation Goal
What is the main message for this audience?

## Target Audience
Who are you presenting to? (Executives, Engineers, Customers)

## Outline
1. **Introduction**: Problem and Vision.
2. **Current Progress**: Key milestones achieved.
3. **Future Strategy**: Roadmap and upcoming initiatives.
4. **Call to Action**: What do you need from the audience?

## Key Assets
Links to required charts, graphs, or demos.`
};

export const getDefaultTemplate = (type: string): string => {
  return DEFAULT_TEMPLATES[type] || `# {{title}}\n\n## Section\n\n...`;
};
