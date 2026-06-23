# PRD: Fix PPTX Export Content Ordering & Summarization

## Problem Statement

When a user downloads a PPTX from a presentation artifact, two critical bugs degrade the output:

1. **Scrambled content ordering**: Slide body content appears grouped by *type* (all body paragraphs first, then all bullets) rather than in the *original document order* the author wrote. This means titles/headers appear bunched together before content, making it impossible to relate a header to its corresponding content.

2. **Lossy AI summarization**: The AI optimization step was discarding information rather than properly condensing it. Key content that didn't fit into the tight AI summary was simply lost — not even saved to speaker notes. This defeats the purpose of the summarization.

## Target User

Product managers, researchers, and analysts who create presentation artifacts from research documents and need to export them as PPTX for sharing or presenting.

## Success Metrics

- Speaker notes contain **all** original content in **document reading order**
- Slide bodies show a clean 3-4 bullet summary without losing information
- No content is lost: every key point from the source document is findable in the notes

## User Stories

1. **As a user**, I want slide speaker notes to appear in the same order as my document so I can read along while presenting.
2. **As a user**, I want each content-heavy slide to show a concise 3-4 bullet summary on screen while keeping full details in the notes.
3. **As a user**, I don't want any of my content to disappear during export — everything should be preserved somewhere.

## Scope

**In scope:**
- Fix `parseMarkdownToSlides` to build ordered speaker notes during line traversal
- Fix the fallback and AI export paths in `MarkdownEditor.tsx` to use those ordered notes
- Revise the AI prompt to request layout + summary only (not restructure content)
- Add automated tests verifying note ordering

**Out of scope:**
- Visual slide design changes
- New layout types
- Changing the markdown format expected by the parser

## Acceptance Criteria

- [ ] Speaker notes show content in document order (intro text before bullets, sub-bullets after their parent)
- [ ] Explicit `**Speaker Notes:**` blocks still win over auto-built notes
- [ ] The AI optimization step only returns layout hint + 3-4 summary bullets
- [ ] No information from source document is lost (all content reachable via notes)
- [ ] All 8 automated tests pass
- [ ] Slide count matches markdown section count (no extra continuation slides)
