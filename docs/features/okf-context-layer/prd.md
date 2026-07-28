# PRD: OKF Context Layer — Structured AI Agent Context

> **Feature**: `okf-context-layer`
> **Branch**: `feature/okf-context-layer`
> **Stage**: Product/Design Agent → **Complete**

---

## 1. Problem Statement

ProductOS AI agents operate with limited, unstructured project awareness:

| Gap | Impact |
|---|---|
| **No semantic steering** | The system prompt tells the AI about the project name/goal in a single flat line. The AI has no structured map of *what rules apply to what tasks*. |
| **Writing rules = raw text dump** | Personalization rules are injected verbatim with no structure. The AI can't distinguish tone rules from formatting rules from banned terms. |
| **Brand design = orphaned** | `brand_settings` is stored in `settings.json` but only used during presentation download — never surfaced to the AI during chat. This is correct for its current use, but the AI has no awareness of brand design intent. |
| **Templates = invisible to AI** | Project-specific templates (`.templates/*.md`) exist on disk but the AI doesn't know about them. When a user asks "create a PRD", the AI doesn't check if a custom PRD template exists. |
| **Personas/Competitors = generic** | Seeded during onboarding as top-level `.md` files, read with the same 10-line preview as any research file. No semantic priority. |
| **No keywords vocabulary** | No mechanism for domain-specific terminology the AI should use, or anti-patterns/words it should avoid. |

**Result**: Inconsistent tone, ignored templates, generic outputs that don't feel like "my product's voice."

---

## 2. Target User / Persona

**Primary**: Product Managers using ProductOS daily to create PRDs, roadmaps, presentations, and research.

**Jobs to be Done**:
- "I want my AI assistant to write in my product's voice without me repeating the rules every time."
- "When I ask for a PRD, I want it to use my team's template, not a generic one."
- "I want the AI to know my competitors and personas without me re-explaining them."
- "I want to know if my project context is incomplete so I can fix it."

---

## 3. User Stories

### US-1: Auto-Generated Context Directory
**As a** PM, **I want** my project settings (personalization, brand, templates) to be automatically materialized as structured context files **so that** every AI interaction has full awareness of my project's rules.

**Acceptance Criteria**:
- When I save project settings, `.metadata/_context/` is generated/updated
- Context files use OKF-compliant YAML frontmatter
- No user action required beyond editing existing settings fields
- Backward compatible: existing projects get context files on first settings save

### US-2: Domain Keywords & Avoided Terms
**As a** PM, **I want** to define domain keywords the AI should use and words/phrases to avoid **so that** generated content uses the correct vocabulary.

**Acceptance Criteria**:
- Two separate input fields in Project Settings > Personalization: "Domain Keywords" and "Keywords to Avoid"
- Stored as separate arrays in `settings.json` (`domain_keywords`, `avoided_keywords`)
- Generated as separate OKF files: `references/keywords.md` and `references/avoided-terms.md`
- AI system prompt references both files

### US-3: Writing Style Starter Template
**As a** PM, **I want** the writing style textarea to include a pre-populated template with common categories **so that** I have a structured starting point to customize.

**Acceptance Criteria**:
- When personalization_rules is empty, show a structured placeholder/template the user can adopt
- Categories: Tone, Voice, Formatting Rules, Banned Words/Phrases, Audience
- User can edit freely — it's a suggestion, not a constraint
- Existing projects with custom rules are NOT overwritten

### US-4: Template-Aware Artifact Creation
**As a** PM, **I want** the AI agent to check for a project-specific template before creating any artifact **so that** it follows my team's structure.

**Acceptance Criteria**:
- `index.md` instructs the AI: "Before creating an artifact, check if a project-specific template exists for that type"
- The AI should use template headers as the document structure
- The AI should ask guiding questions based on the template sections before generating
- If no project template exists, use global default

### US-5: Persona & Competitor Completeness Banner
**As a** PM, **I want** to see a banner on ProductHome when personas or competitors files are missing **so that** I know to create them for better AI context.

**Acceptance Criteria**:
- Banner appears on ProductHome if `personas.md` OR `competitors.md` is missing from the project
- Banner includes a call-to-action to create the missing file(s)
- Banner dismisses automatically once files are created
- When files exist, the context generator creates symlinks/copies in `_context/references/`

### US-6: Guiding Questions per Template
**As a** PM, **I want** the AI to ask relevant questions for each artifact type **so that** it gathers all needed information before generating.

**Acceptance Criteria**:
- Each artifact template type has associated "guiding questions" defined in the context layer
- When the AI creates an artifact, it references these questions
- Questions are configurable (can be extended by the user in future iterations)
- Default questions are provided for: PRD, Roadmap, Product Vision, User Story, One Pager, Presentation, Initiative, Competitive Research, PR-FAQ

---

## 4. Scope

### In Scope (MVP)
- Auto-generated `_context/` directory from existing settings
- `index.md` agent steering file
- `project/overview.md` from name + goal
- `rules/writing-style.md` from personalization_rules (with starter template)
- `rules/brand-design.md` from brand_settings (as code block, preserved for presentation use)
- `references/personas.md` and `references/competitors.md` (symlinks to project-root files)
- `references/keywords.md` and `references/avoided-terms.md` (new)
- Template reference in `index.md` (no file duplication — reference to `.templates/` by convention)
- Guiding questions metadata per template type
- Updated system prompt with OKF awareness
- Domain Keywords + Avoided Keywords UI fields
- Writing style starter template
- ProductHome completeness banner for personas/competitors
- Onboarding compatibility (context generation hooks into `seedPersonalContext` flow)

### Out of Scope
- User-editable raw OKF files (Option B — future)
- Vector/embedding indexing of context files (Silent Learner handles this separately)
- Auto-extraction of keywords from project content (future enhancement)
- Custom OKF concept types beyond the defined set
- Context completeness score widget (keep it simple with banner for now)

---

## 5. Edge Cases

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

## 6. Dependencies

| Dependency | Status | Notes |
|---|---|---|
| [prompt.mjs](file:///Users/assafmiron/Documents/Code/ai-researcher/node-backend/lib/prompt.mjs) | Existing | Must be modified to add OKF injection |
| [context.mjs](file:///Users/assafmiron/Documents/Code/ai-researcher/node-backend/lib/context.mjs) | Existing | Must skip `_context/` from generic file scan |
| [project-settings.mjs](file:///Users/assafmiron/Documents/Code/ai-researcher/node-backend/lib/project-settings.mjs) | Existing | Must add keywords fields and call context generator |
| [starterPack.js](file:///Users/assafmiron/Documents/Code/ai-researcher/src/lib/starterPack.js) | Existing | `seedPersonalContext` must trigger context generation |
| [ProductHome.tsx](file:///Users/assafmiron/Documents/Code/ai-researcher/src/pages/ProductHome.tsx) | Existing | Must add completeness banner |
| [ProjectSettings.tsx](file:///Users/assafmiron/Documents/Code/ai-researcher/src/pages/ProjectSettings.tsx) | Existing | Must add keywords fields + writing style starter |

---

## 7. Prioritized Implementation Slices

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

## 8. API/Contract Assumptions

### New Settings Fields
```typescript
interface ProjectSettings {
  // ... existing fields ...
  domain_keywords?: string[];      // Domain terms AI should use
  avoided_keywords?: string[];     // Terms AI should avoid
}
```

### New API Endpoint
```
GET /api/projects/:id/context-status
Response: {
  hasPersonas: boolean;
  hasCompetitors: boolean;
  hasWritingStyle: boolean;
  hasBrandDesign: boolean;
  hasDomainKeywords: boolean;
  hasAvoidedKeywords: boolean;
  hasTemplateOverrides: boolean;
  lastGenerated: string | null;
}
```

### Generated Directory Structure
```
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

## 9. Guiding Questions per Template Type

These are the default questions the AI should consider when creating an artifact of each type:

### PRD
1. What problem are we solving and for whom?
2. What are the success metrics / KPIs?
3. What is the scope (in/out)?
4. Are there technical constraints or dependencies?
5. What are the key user stories?

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
2. What is the user's goal/job-to-be-done?
3. What are the acceptance criteria?
4. Are there edge cases or error states to handle?

### One Pager
1. What is the proposed solution, in one sentence?
2. What is the business case or ROI?
3. What resources are needed?
4. What is the timeline?

### Presentation
1. Who is the audience?
2. What is the key message or call-to-action?
3. What data/evidence supports the narrative?
4. What is the desired outcome of this presentation?

### Initiative
1. What strategic goal does this initiative serve?
2. What is the expected impact?
3. What are the key milestones?
4. Who are the stakeholders?

### Competitive Research
1. Who are the primary competitors?
2. What dimensions are we comparing (pricing, features, positioning)?
3. What is our differentiation strategy?
4. What recent moves have competitors made?

### PR-FAQ (Amazon Style)
1. What is the customer-facing announcement headline?
2. What customer problem does this solve?
3. What would a skeptical FAQ question look like?
4. What internal FAQ questions should be addressed?

### Product Insight
1. What data or observation triggered this insight?
2. What is the "so what" — why does this matter?
3. What action should be taken based on this insight?
4. What confidence level do we have in this finding?

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
