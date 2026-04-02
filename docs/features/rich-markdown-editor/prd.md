# PRD: Rich Markdown Editor with AI Auto-Completion

**Feature slug:** `rich-markdown-editor`  
**Branch:** `feature/rich-markdown-editor-with-ai-autocomplete`  
**Agent:** Product/Design Agent (Stage 1)

---

## 1. Problem Statement

The current markdown editor in productOS presents two friction points for users:

1. **Reading ≠ Editing**: Users must manually toggle between "View" (rendered) and "Edit" (raw textarea) modes. There is no inline editing — users cannot click a heading and change it without switching to raw markdown mode.
2. **No formatting assistance**: Users must know markdown syntax. There are no Word/Notion-style formatting controls (bold, heading levels, bullet lists, links) available while writing.
3. **No AI assistance at the point of writing**: The AI lives in the Chat panel, separate from the document. There is no inline AI completion that accelerates writing inside the document itself.

**User persona:** product managers and researchers who create documents (PRDs, roadmaps, one-pagers, user stories) in productOS. They want a premium writing experience, not a raw-markdown code editor.

---

## 2. User Stories

### US-1 — Inline WYSIWYG Editing
> As a PM, I want to click anywhere in a rendered document and begin editing inline so that I don't have to switch to a raw textarea and lose my visual context.

### US-2 — Formatting Toolbar
> As a PM, I want a floating/contextual toolbar with formatting options (H1–H3, Bold, Italic, Bullet list, Numbered list, Blockquote, Link, Code) so I can format text without knowing markdown syntax.

### US-3 — Raw Markdown Toggle
> As a power user, I want to switch to a raw markdown view at any time so that I can inspect or edit the underlying markdown directly.

### US-4 — AI Auto-Completion
> As a PM, I want ghost-text AI suggestions as I type so that I can accept them with Tab and write documents faster.

### US-5 — Preserved Save Behavior
> As a user, I want all existing save behaviors (auto-save, manual save, quality check) to continue working unchanged regardless of which editor mode I am in.

---

## 3. Scope

### In Scope (MVP)
- Replace raw `<Textarea>` edit mode with a **Tiptap-based rich editor** that supports inline WYSIWYG editing
- **Floating formatting bubble** that appears on text selection (Bold, Italic, H1–H3, Links, Bullet, Numbered list, Blockquote, Code inline)
- **Raw Markdown toggle** — a third mode alongside "Rich Edit" and "View" (read-only rendered)
- **AI ghost-text auto-completion**: debounced call to the active AI provider, suggestion shown as ghost text, accepted via Tab, dismissed via Escape
- Markdown is the canonical storage format (Tiptap ↔ Markdown conversion via `@tiptap/pm` + `@tiptap/extension-markdown`)
- Slash (`/`) command menu for block-type selection (notion-style)
- All existing features preserved: auto-save, quality check, PPTX export, fix-with-AI

### Out of Scope (V2+)
- Real-time collaboration (WebSockets / CRDTs)
- Image upload / embedding
- Table editing UI
- Comments / annotations
- Version history / diff view
- Tiptap Cloud integration

---

## 4. Acceptance Criteria

| # | Criterion | Test method |
|---|-----------|-------------|
| AC-1 | User can click into rendered content and begin typing without pressing an "Edit" button | Manual / E2E |
| AC-2 | Selecting text shows a floating toolbar with Bold, Italic, H1, H2, H3, Link, Bullet, Numbered, Quote, Code | Manual / E2E |
| AC-3 | Formatting actions apply immediately and render correctly in the document | Manual |
| AC-4 | "Raw MD" toggle switches to a read-only textarea showing the current markdown source | E2E |
| AC-5 | Edits in rich mode persist (auto-save + manual save) as valid markdown files | Unit / Integration |
| AC-6 | After ≥ 1s of idle typing, a ghost-text AI suggestion appears after the cursor | Manual / Integration |
| AC-7 | Pressing Tab accepts the ghost-text suggestion and inserts it at cursor | E2E |
| AC-8 | Pressing Escape or continuing to type dismisses the ghost-text | E2E |
| AC-9 | Quality check, Fix with AI, and PPTX export buttons remain functional | E2E |
| AC-10 | Existing `MarkdownEditor` tests continue to pass | Unit |

---

## 5. Edge Cases

- **Empty document**: Editor should show placeholder text; AI should not suggest on empty state.
- **Very large documents (>10K tokens)**: AI suggestion API call should gracefully time out and fail silently (no ghost text).
- **No AI provider configured**: Ghost-text should be silently disabled (no error toast on every keystroke).
- **Mid-sentence cursor**: AI suggestion should append after the cursor position, not replace selected content.
- **Ctrl+Z / Undo**: Undo history should work inside the rich editor; accepted AI completions should be undoable.
- **Pasted raw markdown**: Tiptap should parse pasted markdown correctly when `@tiptap/extension-markdown` is active.

---

## 6. Dependencies

| Dependency | Version | Notes |
|------------|---------|-------|
| `@tiptap/react` | ^2.x | Core editor framework |
| `@tiptap/starter-kit` | ^2.x | Basic extensions (bold, italic, headings, lists, etc.) |
| `@tiptap/extension-placeholder` | ^2.x | Placeholder text |
| `@tiptap/extension-link` | ^2.x | Hyperlink support |
| `@tiptap/extension-code-block` | ^2.x | Fenced code blocks |
| `@tiptap/extension-bubble-menu` | ^2.x | Selection-based floating toolbar |
| `@tiptap/extension-floating-menu` | ^2.x | Slash command trigger (empty line menu) |
| `markdown-it` or `@tiptap/extension-markdown` | ^1.x | Bidirectional markdown ↔ JSON |
| Existing: `react-markdown`, `remark-gfm` | — | Kept for "View" (read-only) mode |
| Existing: Tauri backend | — | No backend changes needed |

---

## 7. Implementation Slices

### Slice 1 — Foundation (MVP blocker)
- Install Tiptap packages
- Create `RichMarkdownEditor` component (replaces textarea in edit mode)
- Wire to existing save/load flow
- Markdown ↔ Tiptap JSON bidirectional serialization

### Slice 2 — Formatting Toolbar
- Bubble menu on text selection
- Floating menu on empty-line slash trigger
- All toolbar actions

### Slice 3 — AI Auto-Completion
- Debounced AI ghost-text on cursor idle
- Tab-to-accept / Escape-to-dismiss
- Graceful degradation when no provider

### Slice 4 — Raw Markdown Mode
- Three-way toggle: Rich Edit / View (read-only) / Raw MD
- Raw MD mode shows editable textarea with live markdown

### Slice 5 — Polish & Tests
- Unit tests, E2E tests
- Accessibility review
- QA signoff

---

## 8. API / Contract Assumptions

- **Storage**: unchanged — markdown files read/written via `tauriApi.readMarkdownFile` / `tauriApi.writeMarkdownFile`
- **AI completion**: reuse `tauriApi.sendMessage` with a short system prompt asking for completion of a partial sentence/paragraph, passing `projectId` and the last ~500 chars of context
- **No new Tauri commands required for MVP**

---

## Handoff Contract — Product → UX

- **Summary**: PRD complete. Core problem, user stories, AC, scope and dependencies defined.
- **Decisions made**: Use Tiptap v2 as editor framework; AI autocomplete via existing `sendMessage` API; no new backend commands needed.
- **Open risks**: Tiptap markdown serialization fidelity for complex tables and GFM extensions; AI latency may make ghost-text feel laggy on slow providers.
- **Artifacts produced**: `docs/features/rich-markdown-editor/prd.md`
- **Handoff to next agent**: UX Agent — produce user flow and UI/UX specs
- **Blockers**: None
