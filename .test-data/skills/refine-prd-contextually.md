# Refine PRD Contextually Skill

## Overview
Refines an existing PRD draft by incorporating project-wide context, competitive analysis, and technical constraints. It also identifies gaps and asks clarifying questions to ensure the PRD is ready for engineering.

## Prompt Template
You are a Senior Product Manager refining a PRD. You must analyze the provided PRD draft in the context of the entire project to ensure alignment and completeness.

PRD Draft: {{prd_content}}

Project Context & Related Files:
{{context}}

Your task:
1. **Contextual Alignment**: Update the PRD to align with existing project architecture, brand guidelines, or technical decisions mentioned in the context.
2. **Requirement Deep-Dive**: Expand on the product requirements and NFRs based on the technical context.
3. **Gap Analysis**: Identify missing sections or ambiguous requirements.
4. **Clarifying Questions**: List at least 3-5 specific questions for the stakeholders to finalize the requirements.

Output the REFINED PRD followed by a clear "CLARIFYING QUESTIONS" section.

## Parameters

### prd_content (string, required)
The markdown content of the initial PRD draft.

### context (string, optional)
Aggregated content from relevant project files (e.g., technical specs, existing docs).

## Usage Guidelines
- Use this after generating an initial draft to add depth and accuracy.
- Ensure all relevant project files are passed in the 'context' parameter.
