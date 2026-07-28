# UX Spec: OKF Context Layer — User Interaction & UI Design

> **Feature**: `okf-context-layer`
> **Branch**: `feature/okf-context-layer`
> **Stage**: UX Agent → **Complete**

---

## 1. Executive Summary

This UX specification defines the user interface updates and interaction flows for the OKF Context Layer in ProductOS:

1. **Product Home Completeness Banner**: Prompts users to create `personas.md` or `competitors.md` when missing, completing the project's AI context graph.
2. **Personalization Settings Enhancements**:
   - **Domain Keywords**: Input area for terms the AI should actively use.
   - **Keywords to Avoid**: Input area for banned or restricted terms/phrases.
   - **Writing Style Starter Template**: One-click action to load a structured template into empty writing rules.
3. **Template Guiding Questions Flow in Copilot**: Interaction pattern where AI agents ask template-specific questions before artifact generation.

---

## 2. User Flows

### Flow A: Context Completeness Banner on ProductHome
```
[User lands on ProductHome]
       │
       ▼
┌──────────────────────────────┐
│ Missing personas.md OR       │
│ competitors.md?              │
└──────────────┬───────────────┘
               │
      Yes ─────┴───── No
       │              │
       ▼              ▼
┌──────────────┐ ┌────────────────┐
│ Show Amber   │ │ Show Normal    │
│ Context CTA  │ │ Product Home   │
│ Banner       │ │ (No banner)    │
└──────┬───────┘ └────────────────┘
       │
 [Click "Create Personas"]
       │
       ▼
┌──────────────────────────────┐
│ Create default personas.md   │
│ in project root              │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Backend auto-generates       │
│ _context/references/         │
│ personas.md                  │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Banner auto-dismisses with   │
│ success toast                │
└──────────────────────────────┘
```

---

### Flow B: Configuring Personalization & Keywords in Project Settings
```
[Project Settings → Personalization Tab]
       │
       ▼
┌────────────────────────────────────────────────────────┐
│ Section 1: Writing Rules & Tone of Voice               │
│ - Textarea (with "Load Starter Template" button if     │
│   field is empty)                                      │
└───────────────────────┬────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│ Section 2: Domain Keywords (To Use)                    │
│ - Tag input or comma-separated textarea                │
│ - Helper: "Terms the AI should prioritize in copy"     │
└───────────────────────┬────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│ Section 3: Keywords to Avoid (Forbidden Terms)        │
│ - Tag input or comma-separated textarea                │
│ - Helper: "Jargon, competitor names, or banned words"   │
└───────────────────────┬────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│ Section 4: Brand Design Rules                          │
│ - Code block / JSON textarea (for presentation mode)   │
└───────────────────────┬────────────────────────────────┘
                        │
 [Click "Save Product Settings"]
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│ Backend materializes .metadata/_context/ OKF files     │
│ Toast: "Settings saved & AI context updated"           │
└────────────────────────────────────────────────────────┘
```

---

### Flow C: Template Guiding Questions in Chat
```
[User: "Create a PRD for search feature"]
       │
       ▼
┌────────────────────────────────────────────────────────┐
│ AI Agent reads _context/index.md                        │
│ Checks for .templates/prd.md (or global default)       │
│ Reads _context/templates/guiding-questions.md         │
└───────────────────────┬────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│ AI Copilot responds with structured questions:         │
│ "Before I draft your PRD using your team's template,   │
│ please clarify:                                        │
│ 1. What problem are we solving?                        │
│ 2. What are the key success metrics?                   │
│ 3. Any specific scope boundaries?"                     │
└───────────────────────┬────────────────────────────────┘
                        │
 [User answers in chat]
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│ AI generates full PRD artifact adhering strictly to    │
│ the template headers & context rules                   │
└────────────────────────────────────────────────────────┘
```

---

## 3. Screen Specs & Micro-Copy

### Screen 1: ProductHome Completeness Banner

**Placement**: Positioned directly below the product header title and stats bar on `ProductHome.tsx`.

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│ 💡 AI Context Warning                                                            │
│ Your product context is missing personas.md and competitors.md.                  │
│ Adding these files helps AI agents tailor recommendations to your target users.  │
│                                                                                   │
│ [ + Create Personas File ]    [ + Create Competitors File ]   [ Dismiss ]         │
└───────────────────────────────────────────────────────────────────────────────────┘
```

**UI Copy**:
- **Title**: `Improve your AI Agent Context`
- **Body**: `Your project is missing a personas or competitors file. Seed these files to give AI agents accurate customer and market context.`
- **Button 1**: `+ Add Personas` (creates `personas.md` with default template)
- **Button 2**: `+ Add Competitors` (creates `competitors.md` with default template)

---

### Screen 2: Personalization Settings Enhancements

**Placement**: In `ProjectSettings.tsx` under the `personalization` section.

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│ Personalization                                                                   │
│ Configure AI writing rules, vocabulary, and brand guidelines for this project.    │
├───────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│ Writing Rules & Tone of Voice                                                     │
│ Define tone, sentence length, and formatting rules.                               │
│                                                                                   │
│ [ Load Starter Template ]   (shows when textarea is empty)                         │
│ ┌───────────────────────────────────────────────────────────────────────────────┐ │
│ │ ## Tone & Voice                                                               │ │
│ │ - Tone: Professional, clear, and direct                                      │ │
│ │ - Sentence structure: Short sentences, active voice                            │ │
│ │ ## Formatting Rules                                                           │ │
│ │ - Use bullet points over dense paragraphs                                     │ │
│ └───────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                   │
│ ─── DOMAIN VOCABULARY ─────────────────────────────────────────────────────────── │
│                                                                                   │
│ Preferred Domain Keywords                                                         │
│ Terms, acronyms, and product terminology the AI should use (comma-separated).     │
│ ┌───────────────────────────────────────────────────────────────────────────────┐ │
│ │ ProductOS, OKF, Agent Steering, Discovery Phase, First-Class Artifact         │ │
│ └───────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                   │
│ Keywords & Phrases to Avoid                                                       │
│ Banned buzzwords, competitors to refrain from mentioning, or restricted jargon.   │
│ ┌───────────────────────────────────────────────────────────────────────────────┐ │
│ │ synergy, paradigm shift, leverage, low-hanging fruit                          │ │
│ └───────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                   │
│ ─── BRAND DESIGN ──────────────────────────────────────────────────────────────── │
│                                                                                   │
│ Brand Design Rules (Presentation Mode)                                           │
│ Colors, typography, and visual rules used when generating downloadable decks.     │
│ ┌───────────────────────────────────────────────────────────────────────────────┐ │
│ │ { "colors": { "primary": "#003366" }, "fonts": { "heading": "Inter" } }       │ │
│ └───────────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Accessibility Requirements

- **Keyboard Navigation**: All new buttons (`Load Starter Template`, `Add Personas`, `Add Competitors`) must be keyboard-accessible via `Tab` and triggerable via `Enter`/`Space`.
- **Screen Reader Labels**: Textareas for keywords must have associated `<Label>` elements with explicit `htmlFor` attributes.
- **Focus Rings**: Standard Tailwind/Radix focus rings (`focus-visible:ring-2`) on all input elements.
- **Color Contrast**: Banner alert uses `bg-amber-500/10` with text `text-amber-800 dark:text-amber-200` to satisfy WCAG AA contrast standards.

---

## 5. Screen States

| Screen | Empty State | Loading State | Error State | Success State |
|---|---|---|---|---|
| **ProductHome Banner** | Hidden if all files exist | Button shows spinner while creating file | Toast: "Failed to create file" | Toast: "personas.md created!" + banner disappears |
| **Writing Rules** | "Load Starter Template" button visible | Save button shows spinner | Validation error toast | Toast: "Settings saved" |
| **Domain Keywords** | Placeholder: "e.g. SaaS, ProductOS, Discovery" | Disabled during save | Toast on network error | Saved to `settings.json` |
| **Avoided Keywords** | Placeholder: "e.g. synergy, leverage, paradigm shift" | Disabled during save | Toast on network error | Saved to `settings.json` |

---

## UX Agent Handoff

| Section | Status |
|---|---|
| **Summary** | Complete UX spec covering ProductHome completeness banner, settings input fields for domain/avoided keywords, starter template loader, and guiding questions chat interaction |
| **Decisions made** | Use clear textareas with comma-separated values for keywords (simple, familiar UI). Embed "Load Starter Template" button directly inside empty writing rules field. Banner on ProductHome uses warning styling with direct 1-click file creation buttons. |
| **Open risks** | User might click "Load Starter Template" by accident and overwrite custom text (mitigated: button only visible when field is empty). |
| **Artifacts produced** | `docs/features/okf-context-layer/ux-spec.md` |
| **Handoff to next agent** | Frontend & Backend Agents — proceed with code implementation based on PRD + UX Spec |
| **Blockers** | None |
