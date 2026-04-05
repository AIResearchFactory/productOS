# UX Spec: AI Completion Isolation

**Feature slug:** `rich-markdown-editor-completion-fix`  
**Branch:** `feature/fix-ai-completion-isolation`  
**Agent:** UX Agent (Stage 2)

---

## 1. Primary User Flow

1.  **User focuses** the Rich Markdown Editor.
2.  **User types** content.
3.  **Idle state** (500ms+): System requests AI completion for current cursor position.
4.  **Completion arrived**: Suggestion appears as light-grey "ghost text" after the cursor.
5.  **Side effect (CRITICAL)**: No changes should happen in the AI Chat sidebar. No typing indicators, no bubbles, no scroll-to-bottom.
6.  **User accepts (Tab)**: Ghost text becomes real text.
7.  **User dismisses (Esc or continue typing)**: Ghost text vanishes.

## 2. Screen States

- **Ghost Text Present**: Light grey font (e.g., `opacity: 0.4`), inline in the document.
- **Loading Completion**: No change to UI (ghost-text just appears when ready). No spinners or artifacts in the chat.
- **Chat Sidebar**: Remains in its last state, unaffected by completion requests in the document editor.

## 3. Interaction Notes

- **Keyboard Focus**: Focus must remain in the editor at all times. Completion requests should not steal focus or influence keyboard event propagation to the chat window.
- **Redundancy**: No "Completion successful" or "Loading..." toasts should be shown for these background requests.

## 4. Handoff Contract — UX → FE/BE

- **Summary**: UX flow defined. Emphasis on ZERO visibility of completions in the sidebar.
- **Decisions made**: Keep the ghost-text visual style same as before, but eliminate all sidebar side effects.
- **Open risks**: AI latency might cause ghost-text to take a second to appear, which is acceptable for MVP.
- **Artifacts produced**: `docs/features/rich-markdown-editor/ux-spec-completion-fix.md`
- **Handoff to next agent**: Frontend/Backend Agents — implementation plan and execution.
