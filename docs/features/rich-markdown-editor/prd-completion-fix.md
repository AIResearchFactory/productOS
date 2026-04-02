# PRD: Inline AI Completion Fix

**Feature slug:** `rich-markdown-editor-completion-fix`  
**Branch:** `feature/fix-ai-completion-isolation`  
**Agent:** Product/Design Agent (Stage 1)

---

## 1. Problem Statement

The current implementation of inline AI completion in the rich markdown editor has two major issues:
1. **Lack of Isolation**: Completion requests are sent using the `send_message` command, which triggers the full `AgentOrchestrator` loop. This results in completions being saved to chat history, logged in the research log, and displayed in the AI chat window.
2. **UI Pollution**: Because it reuses the chat pipeline, completion responses are treated as "assistant" messages in the chat UI, often appearing as the first message if no prior chat exists, which confuses the user.

**User persona:** product managers who want to write documents with AI assistance without cluttering their chat history with hundreds of partial sentence completions.

---

## 2. User Stories

### US-1 — Isolated AI Completion
> As a PM, I want my ghost-text AI suggestions to be private and temporary so that they don't clutter my chat history or the research log.

### US-2 — Immediate Ghost-Text Feedback
> As a PM, I want the ghost-text to appear ONLY in the editor at my cursor position, and NOT in the sidebar chat window.

---

## 3. Scope

### In Scope
- Create a new backend command `get_completion` that bypasses the `AgentOrchestrator` and calls `AIService.chat` directly.
- Ensure `get_completion` does NOT save to history, log research events, or emit `chat-delta` events.
- Update the frontend `tauriApi` to expose `getCompletion`.
- Refactor `useAiCompletion.ts` to use the new isolated API.

### Out of Scope
- Changing the AI model behavior or prompt (unless necessary for the fix).
- Adding new editor features.

---

## 4. Acceptance Criteria

| # | Criterion | Test method |
|---|-----------|-------------|
| AC-1 | Typing in the editor triggers an AI suggestion request that is NOT visible in the chat window. | Manual |
| AC-2 | AI suggestions are NOT saved to the project's chat history files. | Manual / Integration |
| AC-3 | AI suggestions are NOT logged in the Research Log. | Manual |
| AC-4 | No `chat-delta` events are emitted for completion requests. | Manual / Monitoring |
| AC-5 | Tab still accepts the suggestion, and it still appears as ghost-text in the editor. | Manual |

---

## 5. Dependencies

- `AIService`: Must expose a direct `chat` method without side effects (already exists).
- `chat_commands.rs`: New command `get_completion` needs to be added.
- `tauriApi.ts`: Needs update.
- `useAiCompletion.ts`: Needs update.

---

## 6. Implementation Slices

### Slice 1 — Backend Isolation
- Implement `get_completion` in `chat_commands.rs`.
- Register the command in `lib.rs`.

### Slice 2 — Frontend Integration
- Update `tauriApi.ts` with `getCompletion`.
- Update `useAiCompletion.ts` to use `getCompletion`.

---

## 7. Handoff Contract — Product → UX

- **Summary**: PRD for completion isolation is ready.
- **Decisions made**: Move completion logic away from `AgentOrchestrator` to a direct `AIService` call.
- **Open risks**: None identified.
- **Artifacts produced**: `docs/features/rich-markdown-editor/prd-completion-fix.md`
- **Handoff to next agent**: UX Agent — produce user flow and UI/UX specs.
