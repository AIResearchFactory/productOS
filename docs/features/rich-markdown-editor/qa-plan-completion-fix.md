# QA Plan: AI Completion Isolation

**Feature slug:** `rich-markdown-editor-completion-fix`  
**Branch:** `feature/fix-ai-completion-isolation`  
**Agent:** QA Strategy Agent (Stage 5)

---

## 1. Risk-Based Test Matrix

| Risk | Impact | Mitigation Test |
|---|---|---|
| Completion still appears in chat | High | Verify `get_completion` does not emit `chat-delta`. |
| Completion saved to history | High | Check `chat_history.json` after several completions. |
| completion fails silently | Medium | Verify ghost-text appears after 500ms idle. |
| Cost not tracked | Low | (Known omission) Verify cost budget isn't impacted by completions. |

## 2. Functional Test Scenarios

### Scenario 1: Isolated Suggestion
1. Open a project.
2. Open a document in "View & Edit" mode.
3. Type "The future of product management is".
4. Wait 1 second.
5. **Expected**: Ghost text appears.
6. **Expected**: Chat sidebar remains empty/unchanged.
7. **Expected**: Research log has no new entries.

### Scenario 2: Acceptance
1. Trigger a suggestion.
2. Press `Tab`.
3. **Expected**: Suggestion is inserted into the document.
4. **Expected**: Ghost text disappears.
5. **Expected**: No chat message is created for this insertion.

## 3. Regression Scope

- Verify regular Chat still works (using `send_message`).
- Verify Chat messages still appear in history and sidebar.

## 4. Exit Criteria

- [ ] Manual verification that `get_completion` doesn't populate the chat.
- [ ] No regressions in standard chat functionality.
