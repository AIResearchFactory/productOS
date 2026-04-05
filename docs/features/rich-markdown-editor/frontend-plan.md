# Frontend Plan: Rich Markdown Editor with AI Auto-Completion

**Agent:** Frontend Agent (Stage 3)  
**Input:** `prd.md` + `ux-spec.md`

---

## 1. Component Plan

### New Components

| File | Purpose |
|------|---------|
| `src/components/workspace/RichMarkdownEditor.tsx` | New Tiptap-based WYSIWYG editor (replaces the textarea in Edit mode) |
| `src/components/workspace/EditorToolbar.tsx` | Bubble menu toolbar (bold, italic, headings, link, etc.) |
| `src/components/workspace/SlashCommandMenu.tsx` | Slash command dropdown for block type selection |
| `src/components/workspace/AiGhostText.tsx` | Custom Tiptap extension for ghost-text rendering |
| `src/lib/editorMarkdown.ts` | Markdown ↔ Tiptap HTML/JSON serialization utilities |
| `src/hooks/useAiCompletion.ts` | Debounced AI completion hook |

### Modified Components

| File | Change |
|------|--------|
| `src/components/workspace/MarkdownEditor.tsx` | Replace textarea with `RichMarkdownEditor`; add 3-way mode toggle (`rich` / `raw` / `view`) |

---

## 2. State & Event Model

```typescript
// MarkdownEditor.tsx state additions
type EditorMode = 'rich' | 'raw' | 'view';
const [editorMode, setEditorMode] = useState<EditorMode>('rich');
const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);

// Mode transition logic
const handleModeChange = (newMode: EditorMode) => {
  if (editorMode === 'raw' && newMode !== 'raw') {
    // Parse raw markdown textarea back into content state
    setContent(rawMarkdownValue);
  }
  if (editorMode === 'rich' && newMode === 'raw') {
    // Serialize Tiptap editor content to markdown (via editorRef)
    setRawMarkdownValue(editorRef.current?.storage?.markdown?.getMarkdown() ?? content);
  }
  setEditorMode(newMode);
};
```

### AI Completion Hook
```typescript
// src/hooks/useAiCompletion.ts
export function useAiCompletion(projectId?: string) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const pendingRef = useRef<AbortController | null>(null);

  const requestCompletion = useDebouncedCallback(async (context: string) => {
    if (context.length < 10) return;
    pendingRef.current?.abort();
    const ac = new AbortController();
    pendingRef.current = ac;
    try {
      const res = await tauriApi.sendMessage([
        { role: 'system', content: 'You are an autocomplete assistant. Complete the following text with 1–2 sentences maximum. Only return the completion, not the original text.' },
        { role: 'user', content: context.slice(-600) }
      ], projectId);
      if (!ac.signal.aborted) setSuggestion(res.content.trim());
    } catch {
      setSuggestion(null);
    }
  }, 1000);

  const dismiss = () => {
    pendingRef.current?.abort();
    setSuggestion(null);
  };

  return { suggestion, requestCompletion, dismiss };
}
```

---

## 3. Tiptap Extension Plan

### Core Extensions (via StarterKit)
- `Bold`, `Italic`, `Strike`, `Code`
- `Heading` (levels 1–3)
- `BulletList`, `OrderedList`, `ListItem`
- `Blockquote`, `CodeBlock`, `HorizontalRule`
- `History` (undo/redo)

### Additional Extensions
- `@tiptap/extension-link` — hyperlink support
- `@tiptap/extension-placeholder` — empty editor placeholder
- `@tiptap/extension-bubble-menu` — selection-based floating toolbar
- `@tiptap/extension-floating-menu` — floating menu on empty line (slash trigger)
- `@tiptap/extension-markdown` — markdown serialization/deserialization

### Custom Extension: AI Ghost Text
```typescript
// Implemented as ProseMirror decoration, not a Tiptap node
// Renders ghost text after cursor position using EditorView.decorations
// State held externally (aiSuggestion prop); extension reads it
// Tab key binding: insert suggestion text, clear it
// Escape key binding: clear suggestion
```

### Custom Extension: Slash Commands
```typescript
// Triggered by "/" at start of empty line
// Uses Tiptap's @tiptap/suggestion package for popup logic
// Items: Heading 1–3, Bullet List, Numbered List, Blockquote, Code Block, HR
// Renders as a small dropdown positioned at cursor
```

---

## 4. Package Changes

```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit \
  @tiptap/extension-link @tiptap/extension-placeholder \
  @tiptap/extension-bubble-menu @tiptap/extension-floating-menu \
  @tiptap/extension-markdown @tiptap/suggestion
```

---

## 5. API Contract Usage

- **Load**: `tauriApi.readMarkdownFile(projectId, fileName)` → string → passed to Tiptap `content` as markdown
- **Save**: Tiptap `editor.storage.markdown.getMarkdown()` → string → `tauriApi.writeMarkdownFile(projectId, fileName, markdownString)`
- **AI completion**: `tauriApi.sendMessage([system, user], projectId)` — existing API, no changes

---

## 6. Responsive Behavior

- Max width constraint `max-w-3xl mx-auto` preserved (matches current layout)
- Bubble toolbar repositions automatically via Tiptap (uses Floating UI under the hood)
- Slash menu uses fixed position anchored to cursor; scrolls with document

---

## 7. Implementation Notes & Risks

| Risk | Mitigation |
|------|-----------|
| Tiptap `@tiptap/extension-markdown` may not handle all GFM edge cases (tables, task lists) | Add `remark-gfm` as fallback; preserve `react-markdown` for View mode |
| AI ghost text may feel laggy with slow providers (Ollama local) | Show ghost text only after full response; do not stream into ghost text area |
| Bundle size increase (~180KB for Tiptap core) | Acceptable for Tauri desktop app; no browser bundle constraints |
| Undo history crossing mode boundaries (raw ↔ rich) | Undo history is reset on mode switch; warn user if there are unsaved changes |

---

## 8. PR-Ready Checklist

- [ ] Install Tiptap packages (`npm install`)
- [ ] Create `src/lib/editorMarkdown.ts`
- [ ] Create `src/hooks/useAiCompletion.ts`
- [ ] Create `src/components/workspace/RichMarkdownEditor.tsx`
- [ ] Create `src/components/workspace/EditorToolbar.tsx`  
- [ ] Create `src/components/workspace/SlashCommandMenu.tsx`
- [ ] Update `src/components/workspace/MarkdownEditor.tsx` — 3-way toggle + mode routing
- [ ] All existing AC tests pass
- [ ] New unit tests for `useAiCompletion` and `editorMarkdown`
- [ ] E2E coverage for rich edit + ghost text accept

---

## Handoff Contract — Frontend → QA / Unit Tests / E2E

- **Summary**: Component plan, state model, Tiptap extension strategy, and AI hook design finalized.
- **Decisions made**: Tiptap v2 + `@tiptap/extension-markdown` for serialization; custom decoration for ghost text; existing `sendMessage` API for AI; no new backend commands.
- **Open risks**: Markdown serialization edge cases with complex tables; undo history reset on mode switch.
- **Artifacts produced**: `docs/features/rich-markdown-editor/frontend-plan.md`
- **Handoff to next agent**: QA Strategy + Unit Test + E2E agents
- **Blockers**: None
