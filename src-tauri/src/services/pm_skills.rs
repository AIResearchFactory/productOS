pub fn get_pm_skills_definitions() -> Vec<(&'static str, &'static str)> {
    vec![
        (
            "generate-initiative-draft",
            r#"# Generate Initiative Draft Skill

## Overview
Generates a Product Initiative document explaining the "Why" behind a new feature or project. It focuses on the persona, market context, and the reasoning for the investment.

## Prompt Template
You are an expert Product Manager. Your task is to generate a Product Initiative document for the following feature concept:

Feature Idea: {{feature_idea}}

The Initiative should include:
1. **Persona**: Who is the target user and what are their pain points?
2. **Background**: Context around why this concept is being explored now.
3. **Market View**: Current market trends or needs relevant to this idea.
4. **Competitive View**: How do competitors handle this? Where are the gaps?
5. **Reasoning**: Why should we do this? What is the core business value or strategic alignment?

Please use a professional, persuasive, and data-oriented tone.

## Parameters

### feature_idea (string, required)
The high-level idea or concept for the new initiative.

## Usage Guidelines
- Best used at the earliest stage of product discovery.
- Output should be saved as an **Initiative** artifact.
"#
        ),
        (
            "generate-prd-draft",
            r#"# Generate PRD Draft Skill

## Overview
Generates a Product Requirements Document (PRD) focusing on the "What" and "How". It organizes the background, assumptions, product requirements, and non-functional requirements.

## Prompt Template
You are an expert Product Manager. Your task is to generate a Product Requirements Document (PRD) based on a concept or initiative:

Input: {{input_content}}

The PRD should include:
1. **Background**: Brief context and goal of the feature.
2. **Assumptions**: Technical or business assumptions being made.
3. **Product Requirements**: Detailed functional requirements and behavior.
4. **Non-Functional Requirements**: Performance, security, scalability, and UX constraints.

This document complements the User Stories by providing the structural framework.

Please use a professional, clear, and structured tone.

## Parameters

### input_content (string, required)
The feature idea or reference to an existing initiative.

## Usage Guidelines
- Use this after the Initiative has been defined to detail the specific requirements.
- Output should be saved as a **PRD** artifact.
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
"#
        ),
        (
            "generate-user-stories",
            r#"# Generate User Stories Skill

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
"#
        ),
        (
            "pptx-pitch-architect",
            r#"# PPTX Pitch Architect Skill

## Overview
A high-fidelity agent skill for designing and generating professional PowerPoint (.pptx) business pitches and presentations. It bridges the gap between strategic storytelling and automated file creation.

## Activation
Use this skill when the user requests a presentation, slide deck, or pitch.

Primary Goal: Produce a high-quality Markdown storyboard for the presentation.

## Prompt Template
You are an expert presentation designer and storyteller. Your task is to create a professional, brand-aligned PowerPoint presentation storyboard.

Presentation Topic / Source Content:
{{presentation_topic}}

{{source_content}}

Brand Rules:
{{brand_rules}}

---

### Step 1 — Branding Logic
Proactively look for brand constraints before building any slides:
1. Scan the current project directory for any of these files: `brand.json`, `theme.json`, or `guidelines.md`.
2. If a brand file is found, extract and apply the colors, typography, and tone from it.
3. If no brand file is found and no `brand_rules` are provided in the parameters, use the **Neutral Corporate** default theme:
   - Primary: `#2C3E50` (Midnight Blue)
   - Accent: `#2980B9` (Belize Blue)
   - Text: `#333333`
   - Font: Arial or Helvetica
   
### Step 2 — Narrative Architecture
Structure the deck using this proven pitch framework (unless the user specifies otherwise):
1. **The Hook** — Title slide with a high-level value proposition.
2. **The Problem** — Clearly define the pain point (max 3 bullets).
3. **The Solution** — How the product/service solves the problem.
4. **Market Opportunity** — Data-driven slide (TAM/SAM/SOM or equivalent).
5. **Traction / Roadmap** — What has been achieved and what is next.
6. **The Call to Action** — "The Ask" or clear next steps.

---

### Step 3 — Visual Standards
Apply these rules to every slide:
- **The Squint Test**: If you squint at the slide, the most important element (title or big number) must still be the most visible.
- **Rule of 6**: No more than 6 lines of text per slide.
- **Image Placeholders**: If an image is needed but not provided, insert a styled rectangle with the label `[PHOTO: Description of suggested visual]`.

---

### Step 4 — Markdown Storyboard Generation

Output the full storyboard in this exact format for every slide:

```markdown
# Slide [Number]: [Layout Type]
**Header:** [Title Text]
**Body:**
- [Point 1]
- [Point 2]
**Visual Note:** [Description of layout, colors, and suggested imagery]
**Speaker Notes:** [Script for the presenter]
```

### Step 5 — User Confirmation
After outputting the storyboard, end your response with exactly this message:

"This is the draft storyboard for your presentation. 
Are you ready to create the final PowerPoint file now, or would you like to edit this Markdown first? 
**When you are ready, simply click the 'Download PPTX' button in the editor above to generate the file using your project's brand settings.**"

---

## Parameters

### presentation_topic (string, required)
The main topic, title, or concept for the presentation.

### source_content (string, optional)
Raw content, document text, or notes to be transformed into slides.

### brand_rules (string, optional)
Brand guidelines in JSON or free-text format defining colors, fonts, tone, and assets.
Default: Use Neutral Corporate theme if not provided.

## Usage Guidelines
- Works standalone from the Skills panel: provide a topic and optional brand rules.
- Can be triggered automatically via "Create Presentation from this File" file action.
"#
        ),
        (
            "format-data",
            r#"# Format Data for MCP Skill

## Overview
Structures user story and initiative data into a clean JSON format compatible with MCP servers like Jira, Aha!, or Monday. This skill acts as a bridge between human-readable documentation and automated project management integrations.

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
The text containing user stories or initiatives to be formatted.

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
