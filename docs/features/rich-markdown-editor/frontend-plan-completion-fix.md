# Frontend Plan: AI Completion Isolation

**Feature slug:** `rich-markdown-editor-completion-fix`  
**Branch:** `feature/fix-ai-completion-isolation`  
**Agent:** Frontend Agent (Stage 3)

---

## 1. Goal

Integrate the new `get_completion` API into the `RichMarkdownEditor` ghost-text completion hook.

## 2. API Contract Usage

- **Existing:** Calls `tauriApi.sendMessage` which triggers `send_message` in the backend.
- **New:** Call `tauriApi.getCompletion` which triggers `get_completion` in the backend.

## 3. Responsive Behavior Notes

- None. UI remains identical (ghost-text in the editor).

## 4. Implementation Details

- **`src/api/tauri.ts`**: Add `getCompletion` wrapper.
- **`src/hooks/useAiCompletion.ts`**: Replace `tauriApi.sendMessage` call with `tauriApi.getCompletion`.

## 5. Risks

- AI Completion results might slightly differ without the base "Research Assistant" system prompt, so we should ensure the system prompt passed from `useAiCompletion.ts` is robust.

---

## Handoff Contract — Frontend → QA

- **Summary**: Frontend plan complete. Ready to integrate.
- **Decisions made**: Keep the completion request minimal.
- **Open risks**: None.
- **Artifacts produced**: `docs/features/rich-markdown-editor/frontend-plan-completion-fix.md`
- **Handoff to next agent**: Implementation & QA.
