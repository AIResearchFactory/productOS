# PPTX Pitch Architect Skill

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
