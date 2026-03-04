pub fn get_pm_skills_definitions() -> Vec<(&'static str, &'static str)> {
    vec![
        (
            "generate-prd-draft",
            r#"# Generate PRD Draft Skill

## Overview
Generates an initial Product Requirements Document (PRD) from a high-level feature concept. Use this as the first step in a PM workflow to move from a raw idea to a structured document.

## Prompt Template
You are an expert Product Manager. Your task is to generate a comprehensive initial Product Requirements Document (PRD) for the following feature concept:

Feature Idea: {{feature_idea}}

The PRD should include:
1. **Executive Summary**: High-level overview of the feature.
2. **Problem Statement**: What problem are we solving? Who is the target user?
3. **Goals & Success Metrics**: What does success look like? How will we measure it?
4. **User Personas**: Description of the primary users.
5. **Functional Requirements**: List of core features and their behavior.
6. **Non-Functional Requirements**: Performance, security, and scalability considerations.
7. **Constraints & Assumptions**: Any limitations or dependencies.

Please use a professional, clear, and structured professional tone.

## Parameters

### feature_idea (string, required)
The high-level idea or concept for the new feature.

## Usage Guidelines
- Best used at the beginning of the product discovery phase.
- Output should be saved as a .md file or as a Requirement artifact.
"# 
        ),
        (
            "refine-prd-contextually",
            r#"# Refine PRD Contextually Skill

## Overview
Refines an existing PRD draft by incorporating project-wide context, competitive analysis, and technical constraints. It also identifies gaps and asks clarifying questions to ensure the PRD is ready for engineering.

## Prompt Template
You are a Senior Product Manager refining a PRD. You must analyze the provided PRD draft in the context of the entire project to ensure alignment and completeness.

PRD Draft: {{prd_content}}

Project Context & Related Files:
{{context}}

Your task:
1. **Contextual Alignment**: Update the PRD to align with existing project architecture, brand guidelines, or technical decisions mentioned in the context.
2. **Competitive Edge**: If competitor information is present, suggest enhancements to differentiate the feature.
3. **Gap Analysis**: Identify missing sections or ambiguous requirements.
4. **Clarifying Questions**: List at least 3-5 specific questions for the stakeholders to finalize the requirements.

Output the REFINED PRD followed by a clear "CLARIFYING QUESTIONS" section.

## Parameters

### prd_content (string, required)
The markdown content of the initial PRD draft.

### context (string, optional)
Aggregated content from relevant project files (e.g., competitors, existing docs).

## Usage Guidelines
- Use this after generating an initial draft to add depth and accuracy.
- Ensure all relevant project files are passed in the 'context' parameter.
"#
        ),
        (
            "generate-user-stories",
            r#"# Generate User Stories Skill

## Overview
Transforms a refined PRD into a set of actionable user stories. Each story follows the "As a [user], I want [action], so that [value]" format and includes detailed acceptance criteria.

## Prompt Template
You are a Product Manager/Business Analyst. Your goal is to break down the following PRD into granular, "Ready" user stories for the development team.

PRD Content: {{prd_content}}

For each significant feature/requirement in the PRD, generate:
1. **Title**: Concise name for the story.
2. **User Story**: "As a [persona], I want [action], so that [benefit]."
3. **Acceptance Criteria**: A checklist of 3-5 specific, testable conditions (Given/When/Then style preferred).
4. **Priority**: High/Medium/Low.

Output the stories in a structured list suitable for a backlog or task management tool.

## Parameters

### prd_content (string, required)
The markdown content of the refined PRD.

## Usage Guidelines
- Use this once the PRD is finalized or highly stable.
- The output can be used to populate Jira, Aha!, or other project management tools.
"#
        ),
        (
            "format-data",
            r#"# Format Data for MCP Skill

## Overview
Structures user story and requirement data into a clean JSON format compatible with MCP servers like Jira, Aha!, or Monday. This skill acts as a bridge between human-readable documentation and automated project management integrations.

## Prompt Template
You are a Technical Product Manager. Your task is to extract and format the user stories from the provided text into a structured JSON array suitable for API ingestion or MCP tools.

Input Content: {{input_content}}
Target System: {{target_system}}

Output a JSON array of objects, where each object has:
- `title`: The story title.
- `description`: The "As a..." statement.
- `acceptance_criteria`: A list of strings.
- `priority`: Normalized to "High", "Medium", or "Low".

Output ONLY the raw JSON array. Do not include markdown blocks or extra text.

## Parameters

### input_content (string, required)
The text containing user stories or requirements to be formatted.

### target_system (string, optional)
The intended destination system (e.g., Jira, Aha, Monday).
Default: "Jira"

## Usage Guidelines
- Use this as the final step in a PM workflow before syncing with external tools.
- The output is designed to be passed to an MCP command.
"#
        ),
    ]
}
