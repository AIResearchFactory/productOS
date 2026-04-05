# UX Spec: Rich Markdown Editor with AI Auto-Completion

**Agent:** UX Agent (Stage 2)  
**Input:** `prd.md`

---

## 1. Primary User Flow

```
User opens a document
        │
        ▼
[Rich Edit mode — default]
  Rendered content, inline-editable
  Click anywhere → cursor appears, user types
        │
        ├── User selects text → Bubble toolbar appears
        │       └── Click Bold / H2 / Link etc → formatting applied
        │
        ├── User types "/" on new line → Slash command menu appears
        │       └── Select block type (H1, Bullet, Quote…) → block inserted
        │
        ├── User pauses ≥1s after typing → ghost-text AI suggestion appears
        │       ├── Press Tab → suggestion accepted
        │       └── Press Esc / keep typing → suggestion dismissed
        │
        ├── User clicks "Raw MD" toggle → Raw textarea mode
        │       └── Edit markdown source directly
        │
        └── User clicks "View" toggle → Read-only rendered view (current behaviour)
```

---

## 2. Screen States

### 2a — Rich Edit Mode (default / new default replaces old "Edit" mode)
- Entire document is rendered (headings, bold, lists etc.)
- Cursor visible; typing inserts at cursor position
- **No** "View" / "Edit" binary toggle — document is always editable by click
- Top bar shows: `[Rich ✎]` `[Raw MD]` `[View 👁]` segmented control (3-way)

### 2b — Bubble Toolbar (appears on text selection)
- Floating above selected text
- Buttons (left to right): **Bold** | _Italic_ | `~Strike~` | H1 | H2 | H3 | 🔗 Link | • Bullet | 1. Number | " Quote | `Code`
- Disappears when selection is cleared
- Keyboard shortcut labels shown on hover (Ctrl+B, Ctrl+I etc.)

### 2c — Slash Command Menu (appears when "/" typed on empty line)
- Inline dropdown, max 6 visible items, scrollable
- Items: Heading 1, Heading 2, Heading 3, Bullet List, Numbered List, Blockquote, Code Block, Horizontal Rule
- Fuzzy search as user continues typing after "/"
- Arrow keys to navigate, Enter to select, Escape to dismiss

### 2d — AI Ghost-Text
- Ghost text rendered in muted color (e.g. `text-muted-foreground/50`) immediately after cursor
- Small pill badge `AI ↹ Tab` shown below the ghost text
- **Tab** → accepts full ghost text
- **Escape** → dismisses
- Typing any other character → dismisses ghost text

### 2e — Raw MD Mode
- Full-width monospace textarea with the raw markdown source
- User edits directly; changes sync back to Tiptap state on toggle out
- Banner at top: "You are editing raw markdown. Switch to Rich Edit to see formatting."

### 2f — View Mode (Read-Only)
- Existing ReactMarkdown render (no cursor, no interactivity)
- Same as current "View" behavior

### 2g — Loading State
- Skeleton shimmer overlay while content loads
- No interaction until load complete

### 2h — Error State
- If document fails to load: centered error card with "Retry" button
- If AI suggestion fails: silent — no ghost text, no error toast

---

## 3. Accessibility Requirements

| Requirement | Implementation |
|------------|----------------|
| Keyboard navigable bubble toolbar | All buttons are focusable; Tab to cycle through toolbar items when open |
| Slash menu keyboard navigation | Arrow Up/Down + Enter + Escape |
| Ghost text announce for screen readers | `aria-live="polite"` region describing "AI suggestion available, press Tab to accept" |
| Contrast ratio ≥ 4.5:1 | Ghost text muted color must still meet WCAG AA at its opacity level |
| Focus ring visible | All interactive elements must have visible focus indicator |
| Toggle state labelled | 3-way segmented control uses `role="radiogroup"` + `aria-checked` |

---

## 4. Interaction Notes

### Mode Switcher (3-way segmented control)
- Segment labels: `Rich ✎` / `Raw MD` / `View 👁`
- Active segment: filled background (like current View/Edit buttons)
- On switch from Rich → Raw MD: serialize Tiptap content to markdown, populate textarea
- On switch from Raw MD → Rich: parse markdown string, load into Tiptap state
- On switch → View: serialize to markdown, render via ReactMarkdown

### Auto-save
- Auto-save triggers the same way (25s idle); in Rich Edit mode, markdown is serialized first before writing

### AI Completion Debounce
- 1000ms debounce after last keypress
- Minimum 10 chars typed before first call
- Max context: last 600 chars before cursor
- Response timeout: 5000ms (silent failure)
- One in-flight request at a time (cancel previous if new keystroke)

### Visual Transitions
- Mode switch: fade cross-dissolve (150ms opacity transition)
- Bubble toolbar: fade in 100ms, fade out 80ms
- Ghost text: fade in 200ms
- Slash menu: slide down 120ms from "/" position

---

## 5. UI Copy

| Element | Copy |
|---------|------|
| Mode: Rich Edit | `Rich ✎` |
| Mode: Raw MD | `Raw MD` |
| Mode: View | `View 👁` |
| Ghost text badge | `Tab to accept AI suggestion` |
| Slash command placeholder | `Search for a block type…` |
| Raw MD banner | `Editing raw markdown — switch to Rich Edit to see formatting` |
| Placeholder (empty doc) | `Start writing… type / for commands` |
| AI ghost text (example) | *(greyed continuation of user's last sentence)* |

---

## 6. Handoff Annotations for FE Agent

- Use **Tiptap v2 + StarterKit** as the editor foundation
- `BubbleMenu` for selection toolbar — use Tiptap's built-in `BubbleMenu` extension
- Custom `SlashCommand` extension for "/" menu — build as a Tiptap `InputRule` + `SuggestionPlugin`
- AI ghost-text: implement as a custom Tiptap extension using `Decoration` API to render ghost text without inserting into the document model
- Markdown serialization: use `@tiptap/extension-markdown` package for bidirectional conversion
- Mode state stored as `editorMode: 'rich' | 'raw' | 'view'` in component state
- Ghost-text state stored as `aiSuggestion: string | null` in component state
- Reuse existing `tauriApi.sendMessage` for AI calls; send a concise system prompt + last 600 chars of context
- Keep all existing toolbar button actions (Quality Check, PPTX export, Save, Fix with AI) intact
- The component file being replaced/extended: `src/components/workspace/MarkdownEditor.tsx`

---

## Handoff Contract — UX → Frontend

- **Summary**: UX flow, 8 screen states, accessibility requirements, interaction notes, and copy defined.
- **Decisions made**: 3-way mode switcher; bubble toolbar over selection; tab-to-accept ghost text; 1s debounce for AI; silent failure for AI errors.
- **Open risks**: Tiptap bundle size (~180KB gzipped) — acceptable for desktop Tauri context.
- **Artifacts produced**: `docs/features/rich-markdown-editor/ux-spec.md`
- **Handoff to next agent**: Frontend Agent
- **Blockers**: None
