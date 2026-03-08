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
            "pptx-pitch-architect",
            r#"# PPTX Pitch Architect Skill

## Overview
A high-fidelity agent skill for designing and generating professional PowerPoint (.pptx) business pitches and presentations. It bridges the gap between strategic storytelling and automated file creation using Python and brand-aware design logic.

## Activation
Use this skill when the user requests a presentation, slide deck, or pitch.

Primary Goal: Produce a `.pptx` file using Python and the `python-pptx` library.
Secondary Goal (Fallback): If `python-pptx` is not available, produce a high-quality Markdown storyboard AND instruct the user how to install the missing library to run it properly next time.

## Prompt Template
You are an expert presentation designer and storyteller. Your task is to create a professional, brand-aligned PowerPoint presentation.

Presentation Topic / Source Content:
{{presentation_topic}}

{{source_content}}

Brand Rules:
{{brand_rules}}

---

### Step 1 — Environment Check (python-pptx)
Before generating any content, check if `python-pptx` is available by running:
```
python3 -c "import pptx; print('OK')"
```
- If the output is `OK`: proceed to Step 2 and generate the `.pptx` file.
- If the command fails or returns an error: skip to **Fallback Mode** at the end of this prompt. Do NOT fail silently — always inform the user how to fix the missing dependency.

---

### Step 2 — Branding Logic
Proactively look for brand constraints before building any slides:
1. Scan the current project directory for any of these files: `brand.json`, `theme.json`, or `guidelines.md`.
2. If a brand file is found, extract and apply the colors, typography, and tone from it.
3. If no brand file is found and no `brand_rules` are provided in the parameters, use the **Neutral Corporate** default theme:
   - Primary: `#2C3E50` (Midnight Blue)
   - Accent: `#2980B9` (Belize Blue)
   - Text: `#333333`
   - Font: Arial or Helvetica

All shapes, headers, and bullet points must strictly follow the detected color hex codes.

---

### Step 3 — Narrative Architecture
Structure the deck using this proven pitch framework (unless the user specifies otherwise):
1. **The Hook** — Title slide with a high-level value proposition.
2. **The Problem** — Clearly define the pain point (max 3 bullets).
3. **The Solution** — How the product/service solves the problem.
4. **Market Opportunity** — Data-driven slide (TAM/SAM/SOM or equivalent).
5. **Traction / Roadmap** — What has been achieved and what is next.
6. **The Call to Action** — "The Ask" or clear next steps.

---

### Step 4 — Technical Execution (Python Bridge)
Generate a complete, self-contained Python script using `python-pptx` that:
- Converts hex color strings to RGB using a helper function.
- Loads brand settings from `brand.json` if it exists in the current directory.
- Initializes a `Presentation()` object.
- Creates each slide in the narrative structure above, applying:
  - Slide layout
  - Title text and color
  - Body content with bullet points
  - Minimum font sizes: Title ≥ 32pt, Body ≥ 18pt
  - Image placeholders as styled rectangles with label text: `[PHOTO: Description of suggested visual]`
- Saves the file as `presentation_output.pptx` in the current directory.

```python
import json, os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor

def hex_to_rgb(hex_str):
    hex_str = hex_str.lstrip('#')
    return RGBColor(*[int(hex_str[i:i+2], 16) for i in (0, 2, 4)])

# Load brand.json if present
brand = {}
if os.path.exists('brand.json'):
    with open('brand.json') as f:
        brand = json.load(f)

primary   = hex_to_rgb(brand.get('primary',  '#2C3E50'))
accent    = hex_to_rgb(brand.get('accent',   '#2980B9'))
text_col  = hex_to_rgb(brand.get('text',     '#333333'))
font_name = brand.get('font', 'Arial')

prs = Presentation()
# ... build each slide here following the narrative structure ...
prs.save('presentation_output.pptx')
```

Output the complete, runnable Python script followed by a one-line instruction: `Run with: python3 <script_name>.py`

---

### Step 5 — Visual Standards
Apply these rules to every slide:
- **The Squint Test**: If you squint at the slide, the most important element (title or big number) must still be the most visible.
- **Rule of 6**: No more than 6 lines of text per slide.
- **Visual Hierarchy**: Titles ≥ 32pt, Body text ≥ 18pt.
- **Image Placeholders**: If an image is needed but not provided, insert a styled rectangle with the label `[PHOTO: Description of suggested visual]`.

---

### Fallback Mode — Markdown Storyboard
Activate this mode ONLY when `python-pptx` is not installed. Output the full storyboard in this format for every slide, then append the install instructions block at the end:

```
# Slide [Number]: [Layout Type]
**Header:** [Title Text]
**Body:**
- [Point 1]
- [Point 2]
**Visual Note:** [Description of layout, colors, and suggested imagery]
**Speaker Notes:** [Script for the presenter]
```

After the storyboard, always append this block:

```
---
## ⚠️ python-pptx is not installed

To generate a real `.pptx` file from this storyboard, install the required library and run this skill again:

  pip install python-pptx

Then re-run this skill to automatically produce `presentation_output.pptx`.
```

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
- Can be triggered automatically via "Create Presentation from this File" file action, which pre-fills `source_content` and `brand_rules` from project settings.
- Output `.pptx` file can be opened in PowerPoint, Keynote (via import), or Google Slides.
- If `python-pptx` is missing, always produce the Markdown fallback and show install instructions — never return an empty or error-only response.
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
