# PRD: OKF Context Layer — Structured AI Agent Context

> **Feature**: `okf-context-layer`
> **Branch**: `feature/okf-context-layer`
> **Stage**: Product/Design Agent → **Updated with Feedback**

---

## 1. Problem Statement

ProductOS AI agents operate with limited, unstructured project awareness:

| Gap | Impact |
|---|---|
| **No semantic steering** | The system prompt tells the AI about the project name/goal in a single flat line. The AI has no structured map of *what rules apply to what tasks*. |
| **Writing rules = raw text dump** | Personalization rules are injected verbatim with no structure. The AI can't distinguish tone rules from formatting rules from banned terms. |
| **Brand design = orphaned** | `brand_settings` is stored in `settings.json` but only used during presentation download — never surfaced to the AI during chat. This is correct for its current use, but the AI has no awareness of brand design intent. |
| **Templates = invisible to AI** | Project-specific templates (`.templates/*.md`) exist on disk but the AI doesn't know about them. When a user asks "create a PRD", the AI doesn't check if a custom PRD template exists or ask guiding questions. |
| **Personas/Competitors = generic** | Seeded during onboarding as top-level `.md` files, read with generic preview priority. No semantic priority. |
| **No keywords vocabulary** | No mechanism for domain-specific terminology the AI should use, or forbidden terms/phrases it should avoid. |
| **Sidecar Metadata Awareness** | File-specific `.metadata/{filename}.json` sidecars (summaries, confidence scores, tags, metrics) exist in ProductOS but are not explicitly highlighted to AI agents as primary context sources. |

**Result**: Inconsistent tone, ignored templates, missing non-functional considerations, and generic outputs that don't feel like "my product's voice" or export-ready documents.

---

## 2. Target User / Persona

**Primary**: Product Managers using ProductOS daily to create export-ready PRDs, roadmaps, presentations, one-pagers, and research summaries.

**Jobs to be Done**:
- "I want my AI assistant to write in my product's voice without me repeating the rules every time."
- "When I ask for a PRD, I want the AI to ask me key questions about personas, Jobs-to-be-Done, non-functional requirements (performance, telemetry, security, accessibility), and then use my team's template."
- "I want the AI to know my competitors, personas, and sidecar metadata without me re-explaining them."
- "I want dedicated UI sections to define and review preferred domain keywords and forbidden terms to avoid."

---

## 3. User Stories

### US-1: Auto-Generated Context Directory
**As a** PM, **I want** my project settings (personalization, brand, templates) to be automatically materialized as structured context files **so that** every AI interaction has full awareness of my project's rules.

**Acceptance Criteria**:
- When I save project settings, `.metadata/_context/` is generated/updated
- Context files use OKF-compliant YAML frontmatter
- No user action required beyond editing existing settings fields
- Backward compatible: existing projects get context files on first settings save

### US-2: Domain Keywords & Forbidden Terms UI & Context
**As a** PM, **I want** dedicated UI fields to input, edit, and review preferred domain keywords and forbidden terms/phrases to avoid **so that** generated content uses correct terminology and avoids banned language.

**Acceptance Criteria**:
- Two separate, clear input & review areas in Project Settings > Personalization: "Preferred Domain Keywords" and "Keywords & Phrases to Avoid"
- Stored as separate arrays in `settings.json` (`domain_keywords`, `avoided_keywords`)
- Materialized into separate OKF files: `references/keywords.md` and `references/avoided-terms.md`
- AI system prompt references both files for vocabulary compliance

### US-3: Writing Style Starter Template
**As a** PM, **I want** the writing style textarea to include a pre-populated template with common categories **so that** I have a structured starting point to customize.

**Acceptance Criteria**:
- When personalization_rules is empty, show a structured placeholder/template the user can adopt
- Categories: Tone, Voice, Formatting Rules, Banned Words/Phrases, Audience
- Clarifies that formatting style (bullet points vs narrative) is governed by the specific artifact template being produced
- User can edit freely — it's a suggestion, not a constraint

### US-4: Template-Aware Artifact Creation & Guiding Questions
**As a** PM, **I want** the AI agent to check for a project-specific template before creating any artifact and ask relevant guiding questions **so that** it follows my team's structure and captures all critical details.

**Acceptance Criteria**:
- `index.md` instructs the AI: "Before creating an artifact, check if a project-specific template exists for that type"
- The AI checks `templates/guiding-questions.md` and asks clarifying questions before generating
- For PRDs, questions MUST cover:
  1. Target personas for this feature
  2. Core problem / Job-to-be-Done (JTBD)
  3. Acceptance criteria & scope
  4. Non-functional requirements (Performance, Telemetry, Security, Accessibility, Privacy)

### US-5: Persona & Competitor Completeness Banner
**As a** PM, **I want** to see a banner on ProductHome when personas or competitors files are missing **so that** I know to create them for better AI context.

**Acceptance Criteria**:
- Banner appears on ProductHome if `personas.md` OR `competitors.md` is missing from the project
- Banner includes a call-to-action to create the missing file(s)
- Banner dismisses automatically once files are created
- When files exist, the context generator creates symlinks/copies in `_context/references/`

### US-6: File-Specific Sidecar Metadata Awareness
**As a** PM, **I want** AI agents to be explicitly instructed to read `.metadata/{filename}.json` sidecar files **so that** file summaries, confidence scores, and usage metrics are factored into AI analysis.

**Acceptance Criteria**:
- `_context/project/overview.md` and `_context/index.md` state that file sidecars contain structured metadata (summaries, tags, usage metrics)
- Agents use sidecar metadata to weigh file relevance and quality

---

## 4. Scope

### In Scope (MVP)
- Auto-generated `_context/` directory from existing settings
- `index.md` agent steering file
- `project/overview.md` from name + goal + sidecar metadata instructions
- `rules/writing-style.md` from personalization_rules (tailored for document/presentation exports; formatting driven by templates)
- `rules/brand-design.md` from brand_settings (as code block, preserved for presentation use)
- `references/personas.md` and `references/competitors.md` (symlinks to project-root files)
- `references/keywords.md` and `references/avoided-terms.md` (new)
- Template reference in `index.md`
- Expanded guiding questions metadata per template type (PRD includes personas, JTBD, performance, telemetry, security, accessibility)
- UI fields to enter, edit, and review domain keywords and avoided terms in Project Settings
- Writing style starter template loader
- ProductHome completeness banner for personas/competitors
- Automated test suite (unit tests for context generation, prompt steering, settings schema, and contract validation)

### Out of Scope
- User-editable raw OKF files (Option B — future)
- Vector/embedding indexing of context files (handled separately)
- Auto-extraction of keywords from project content (future enhancement)

---

## 5. Guiding Questions per Template Type (Updated)

### PRD (Product Requirements Document)
1. **Target Personas**: Who are the specific target personas for this feature?
2. **Problem & Job-to-be-Done**: What specific problem or Job-to-be-Done (JTBD) are we solving for them?
3. **Success Metrics**: What are the quantitative KPIs and success criteria?
4. **Scope Boundaries**: What is explicitly in-scope vs. out-of-scope for MVP?
5. **Non-Functional Requirements**:
   - **Performance**: What are latency/throughput/response time targets?
   - **Telemetry & Metrics**: What events, metrics, and tracking logs must be emitted?
   - **Security & Privacy**: What auth, encryption, secret handling, or data retention rules apply?
   - **Accessibility**: What keyboard, screen-reader, or contrast guidelines must be met?

### Roadmap
1. What is the time horizon (quarter, half-year, year)?
2. What are the strategic themes or pillars?
3. What are the high-confidence "Now" items vs exploratory "Later" items?
4. How does this align with company-level OKRs?

### Product Vision
1. What is the core problem this product solves?
2. Who is the primary audience and what are their pain points?
3. What differentiates this from alternatives?
4. What does success look like in 3 years?

### User Story
1. Who is the user persona?
2. What action do they want to perform, and why (benefit)?
3. What are the testable acceptance criteria?
4. Are there edge cases or error states to handle?

---

## 6. Edge Cases

| Edge Case | Handling |
|---|---|
| Project has no settings saved yet | Context directory is not generated until first save |
| `personalization_rules` is empty | `writing-style.md` is NOT generated (no empty files) |
| `brand_settings` is empty | `brand-design.md` is NOT generated |
| `personas.md` doesn't exist in project root | `references/personas.md` is NOT generated; banner shows on ProductHome |
| `competitors.md` doesn't exist in project root | Same as above |
| Project created via onboarding with starter pack | `seedPersonalContext` also triggers context generation |
| Very large personalization_rules (>4K chars) | Cap injection into system prompt at ~2K tokens; full file reference in `index.md` |
| Project with only a name and no goal | `overview.md` generated with just name; goal section says "Not specified" |
| Settings saved with no changes | Context files are regenerated idempotently (timestamp-based skip optimization in V2) |

---

## 7. Dependencies

| Dependency | Status | Notes |
|---|---|---|
| [prompt.mjs](../../node-backend/lib/prompt.mjs) | Existing | Must be modified to add OKF injection |
| [context.mjs](../../node-backend/lib/context.mjs) | Existing | Must skip `_context/` from generic file scan |
| [project-settings.mjs](../../node-backend/lib/project-settings.mjs) | Existing | Must add keywords fields and call context generator |
| [starterPack.js](../../src/lib/starterPack.js) | Existing | `seedPersonalContext` must trigger context generation |
| [ProductHome.tsx](../../src/pages/ProductHome.tsx) | Existing | Must add completeness banner |
| [ProjectSettings.tsx](../../src/pages/ProjectSettings.tsx) | Existing | Must add keywords fields + writing style starter |

---

## 8. Prioritized Implementation Slices

### MVP (This PR)
1. **Context Generator module** — generates all `_context/` files
2. **System prompt update** — OKF-aware agent steering in `prompt.mjs`
3. **Keywords fields** — `domain_keywords` + `avoided_keywords` in settings
4. **Writing style starter** — placeholder template for personalization rules
5. **Guiding questions** — per-template-type question sets
6. **ProductHome banner** — personas/competitors completeness
7. **Onboarding hook** — generate context after `seedPersonalContext`

### V2 (Future)
- Auto-keyword extraction from project name/goal/personas
- Context completeness score (0–100%) widget
- User-editable OKF files via UI
- Silent Learner integration for context enrichment
- Custom guiding questions per project

---

## 9. API/Contract Assumptions

### New Settings Fields
```typescript
interface ProjectSettings {
  // ... existing fields ...
  domain_keywords?: string[];      // Domain terms AI should use
  avoided_keywords?: string[];     // Terms AI should avoid
}
```

### New API Endpoint
```json
GET /api/projects/:id/context-status
Response: {
  "hasPersonas": boolean,
  "hasCompetitors": boolean,
  "hasWritingStyle": boolean,
  "hasBrandDesign": boolean,
  "hasDomainKeywords": boolean,
  "hasAvoidedKeywords": boolean,
  "hasContextIndex": boolean
}
```

### Generated Directory Structure
```text
.metadata/_context/
├── index.md                     (agent steering — always generated)
├── project/
│   └── overview.md              (from name + goal)
├── rules/
│   ├── writing-style.md         (from personalization_rules, only if non-empty)
│   └── brand-design.md          (from brand_settings, only if non-empty)
├── templates/
│   └── guiding-questions.md     (default questions per artifact type)
└── references/
    ├── personas.md              (copy from project root, if exists)
    ├── competitors.md           (copy from project root, if exists)
    ├── keywords.md              (from domain_keywords, if any)
    └── avoided-terms.md         (from avoided_keywords, if any)
```

---

## 10. Comprehensive Verification & Automation Strategy

To ensure zero regressions and verified context generation, the implementation MUST include dedicated automated unit tests:

1. **Unit Test Suite (`node-backend/test/context-generator.test.mjs`)**:
   - Verifies `generateContextDirectory()` creates all 7 OKF files with exact schema
   - Tests conditional generation (e.g. empty rules skip file creation)
   - Tests file sidecar metadata reference inclusion in `overview.md`
   - Tests `domain_keywords` and `avoided_keywords` array formatting
2. **Settings API Test (`node-backend/test/project-settings.test.mjs`)**:
   - Tests `saveProjectSettings()` saving and retrieving `domain_keywords` and `avoided_keywords`
   - Verifies trigger of `generateContextDirectory()` on save
3. **System Prompt Test (`node-backend/test/prompt.test.mjs`)**:
   - Tests `buildSystemPrompt()` includes low-token OKF steering block referencing `_context/index.md`
4. **Frontend Component Unit Tests**:
   - Test `ProjectSettings.tsx` keyword input rendering and editing
   - Test `ProductHome.tsx` missing file banner trigger logic
---

## Product/Design Agent Handoff

| Section | Status |
|---|---|
| **Summary** | OKF Context Layer: auto-generated `.metadata/_context/` directory providing structured AI agent context from existing project settings, plus new keywords fields, writing style starter, guiding questions per template, and ProductHome completeness banners |
| **Decisions made** | Option A (auto-generated, not user-editable). Brand settings kept as code block. Template files referenced by convention not duplicated. Separate keyword fields for "use" vs "avoid". Banner approach (not score widget) for completeness. |
| **Open risks** | System prompt token budget increase (~500-1500 tokens). Context regeneration on every save adds ~50ms latency. Symlink compatibility on Windows. |
| **Artifacts produced** | This PRD (`docs/features/okf-context-layer/prd.md`) |
| **Handoff to next agent** | UX Agent — define the UI flows for keywords fields, writing style starter template, and ProductHome banner |
| **Blockers** | None |
