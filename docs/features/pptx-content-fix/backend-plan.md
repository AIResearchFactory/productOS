# Backend Plan: PPTX Content Ordering & Summarization Fix

## Overview

Two bugs fixed, one optimization improved — all in the frontend layer (no Node backend changes needed since PPTX export is entirely client-side via `pptxgenjs`).

## Changes

### 1. `src/lib/pptxExport.ts` — Parser fix

**Function:** `parseMarkdownToSlides`

**Problem:** Speaker notes were assembled AFTER the line loop by concatenating separate arrays:
```js
// OLD (broken ordering)
speakerNotes = [...bodyText, ...bullets, ...subBullets.flat()].join('\n')
```

**Fix:** Build `orderedNotesLines[]` DURING the line loop. Each line is added to this array in the same order it's processed — so body paragraphs and bullets appear interleaved exactly as the author wrote them.

```js
// NEW (correct ordering)
// During line processing:
if (bulletMatch)   orderedNotesLines.push(`• ${bulletText}`);
if (subBulletMatch) orderedNotesLines.push(`  • ${subText}`);
if (bodyText)      orderedNotesLines.push(plainText);
// After the loop:
slide.speakerNotes = orderedNotesLines.join('\n');
slide.fullText = slide.speakerNotes;
```

Sub-bullet ordering was also fixed: previously sub-bullets were matched AFTER bullets, which could cause them to appear before their parent bullet. Now sub-bullets are checked first (they have leading whitespace) before the generic bullet regex.

**Speaker notes priority:** Explicit `**Speaker Notes:**` blocks in the markdown always override the auto-built ordered notes.

---

### 2. `src/components/workspace/MarkdownEditor.tsx` — Export handler fixes

**Three changes in the PPTX download click handler:**

#### Fix A — Fallback path notes (L533-554)
```js
// OLD: re-assembles notes with broken ordering
const allText = [...s.bodyText, ...s.bullets, ...subBullets.flat()].join('\n');
speakerNotes: allText

// NEW: uses pre-built ordered notes from parser
speakerNotes: s.speakerNotes || ''
```

#### Fix B — AI path notes (L637-641)
```js
// OLD: re-assembles notes with broken ordering
const originalContent = [...bodyText, ...bullets, ...subBullets.flat()].join('\n');
speakerNotes: originalContent

// NEW: uses pre-built ordered notes from parser
const orderedNotes = originalSection.speakerNotes || '';
speakerNotes: orderedNotes
```

#### Fix C — AI prompt revision (L574-593)
The old prompt asked the AI to generate content (bodyText/bullets) based on a truncated 800-char snippet. This caused information loss.

The new prompt:
- Sends full ordered notes text (from the parser) as context
- Asks **only** for: `layoutHint`, `bullets` (3-4 summary points ≤10 words each), `bodyText` (0-1 kicker sentence)
- **Explicitly forbids** the AI from returning speakerNotes or fullText
- Removes the 800-char content cap (notes are now independent of AI output)
- Adds detailed layout selection guidance (when to use columns/comparison/timeline/split)

## Testing

New tests in `tests/presentation-layout.test.mjs`:

| Test | Verifies |
|------|----------|
| speakerNotes preserves interleaved order | Body text before bullets, bullets before body text that follows |
| Sub-bullets after parent in notes | Correct nesting order in notes |
| Explicit Speaker Notes overrides | `**Speaker Notes:**` block wins |
| Multiple slides independent notes | No bleed between slides |
| fullText mirrors speakerNotes | fullText is always in sync |

## Backward Compatibility & Contract Changes

- The `SlideData` interface is extended with optional fields (`elements`, `items`, `dominantVisualElement`, `primaryColorEmphasis`, `emotionalTone`) to support rich visual structuring.
- Split and content layout rendering paths now iterate over `data.elements` when available for fine-grained styling and pagination, falling back to legacy fields (`bodyText`/`bullets`) if absent.
- The `speakerNotes` field now consistently compiles the raw document's reading flow in exact interleaved order.
- The new `spotlight` layout is registered in `SUPPORTED_LAYOUTS` and handled via `addSpotlightSlide`.
