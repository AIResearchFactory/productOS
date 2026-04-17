# Generate User Stories Skill

## Overview
Transforms a PRD into detailed, actionable user stories. Each story includes granular logic, edge cases, and expected results.

## Prompt Template
You are a Product Manager/Business Analyst. Your goal is to break down the following PRD into granular, "Ready" user stories.

PRD Content: {{prd_content}}

For each significant feature/requirement in the PRD, generate:
1. **Title**: Concise name for the story.
2. **User Story**: "As a [persona], I want [action], so that [benefit]."
3. **Acceptance Criteria**: Detailed checklist of specific, testable conditions.
4. **Edge Cases & Expected Results**: Identification of non-obvious scenarios and how the system should handle them.
5. **Priority**: High/Medium/Low.

Output the stories in a structured format suitable for development.

## Parameters

### prd_content (string, required)
The markdown content of the PRD.

## Usage Guidelines
- Use this once the PRD is stable.
- Output should be saved as a **User Story** artifact.
