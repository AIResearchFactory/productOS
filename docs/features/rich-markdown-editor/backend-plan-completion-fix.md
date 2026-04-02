# Backend Plan: AI Completion Isolation

**Feature slug:** `rich-markdown-editor-completion-fix`  
**Branch:** `feature/fix-ai-completion-isolation`  
**Agent:** Backend Agent (Stage 4)

---

## 1. Goal

Implement a new Tauri command `get_completion` that provides AI responses WITHOUT triggering the `AgentOrchestrator` side effects (chat history, research logs, events, cost tracking, file parsing).

## 2. API Spec

### Command: `get_completion`
- **Method:** `POST` (Tauri Command)
- **Request Parameters:**
  - `messages: Vec<Message>`: The conversation context (usually 1 system + 1 user).
  - `project_id: Option<String>`: The project ID for provider configuration.
- **Response:**
  - `Result<ChatResponse, String>`: The raw AI response.

## 3. Data Model Changes

- No database or model changes.
- Uses existing `Message` and `ChatResponse` models.

## 4. Business Rules

- **Bypass Orchestrator**: Directly call `ai_service.chat_with_options` instead of `orchestrator.run_agent_loop`.
- **No Side Effects**: 
  - Do NOT call `save_history`.
  - Do NOT call `ResearchLogService::log_event`.
  - Do NOT emit `chat-delta`.
  - Do NOT track costs (initial MVP simplification, can be added later if needed).

## 5. Backward Compatibility

- This is a new command; existing `send_message` remains untouched for chat.

## 6. Implementation Notes

- Add `get_completion` in `src-tauri/src/commands/chat_commands.rs`.
- Register in `src-tauri/src/lib.rs`.

---

## Handoff Contract — Backend → Frontend

- **Summary**: Backend plan complete. New isolated command defined.
- **Decisions made**: Skip cost tracking for completions for now to ensure maximum isolation and simplicity.
- **Open risks**: None.
- **Artifacts produced**: `docs/features/rich-markdown-editor/backend-plan-completion-fix.md`
- **Handoff to next agent**: Frontend Agent — integrate the new command.
