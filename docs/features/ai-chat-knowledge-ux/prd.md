# Product Requirements Document (PRD)

**Feature Name:** AI Chat & Knowledge Workspace Alignment (Contextual Comments & Chat-Centric Workspace)  
**Status:** Approved / In Progress  
**Date:** May 28, 2026  
**Stage:** Product/Design Phase (Stage 1 of the Feature Development Pipeline)

---

## 1. Problem Statement

ProductOS is a knowledge and context management system powered by AI. Currently, the user experience splits the workspace into a left-hand AI Chat Panel and a right-hand Document/Workflow Content Panel. While functional, it has two key user experience friction points:

1. **Lack of Inline Feedback Loops:** When the AI generates an artifact (like a PRD or roadmap) or when a user imports content, there is no direct way to provide targeted feedback on specific sections. Users have to copy-paste parts of the text into the chat and describe what to change, which is slow and error-prone. There is no mechanism equivalent to Google Docs/MS Word comments where a user can highlight text, write a comment, and have the AI act directly on that anchor.
2. **Friction in Chat-Centric Workflows:** In many tasks, the AI chat is the primary driver. If a user expands the chat to full screen, they lose the ability to view, search, or double-check referenced files and previous conversations. If they split the screen, the chat feels squeezed. Users need a "Chat-First" experience that puts the chat in the focus (center stage) while providing a low-overhead, context-preserving way to "peek" at files or reference items without losing their active prompt state.

---

## 2. User Stories

### Story 1: Inline Contextual Comments (Revision Loop)
* **As a** Product Manager or Researcher,
* **I want to** highlight any section of text in my active document (PRD, User Story, competitive research, etc.) and add a comment on it,
* **So that** I can send the comment to the AI agent as a structured change request, letting the AI automatically update only the relevant parts of the document while leaving the rest intact.

### Story 2: Fix All Comments
* **As a** User editing a document with multiple open feedback points,
* **I want to** click a single "Fix All Comments" button at the top of my document,
* **So that** the AI receives all comments at once, processes them, streams the proposed combined changes to the chat, and updates the document in one clean "Accept/Reject" approval step.

### Story 3: File Peeking in Chat-Centric Mode
* **As a** User focusing on a high-level chat conversation,
* **I want to** put the chat in a focused, centered view and easily reference product files using `@filename`,
* **So that** I can click and "peek" into those files in a side drawer/drawer card without losing my active conversation thread, losing my current input cursor, or switching away from the chat screen entirely.

### Story 4: Right-Click "Reference in Chat" Shortcut
* **As a** User navigating my file directory sidebar,
* **I want to** right-click any product file and click "Reference in Chat",
* **So that** the file tag (e.g. `@filename`) is instantly inserted into the chat input bar without me having to type it out.

---

## 3. Scope Boundaries

### In Scope
1. **Clean Marginal Comments Registry (.json sidecars):**
   - Comments must **not** be stored inline within the Markdown content. Markdown files remain strictly clean, standard, and portable.
   - All comments are stored in `.metadata/comments/{fileId}.json` mapping selection anchors by character offset/index range and text match.
   - Comment attributes: `id`, `text`, `anchorText`, `anchorIndex`, `status` (`'open' | 'resolved'`), `createdAt`, `author`.
   - The JSON metadata serves as a direct structured context feed for the AI, allowing the agent to read and track comments.
2. **Comment Resolution Workflows (Two Modes):**
   - **Mode 1 (Single Resolution):** Clicking "Ask AI to Resolve" streams the proposed revision into the Chat Panel with a visual Accept/Reject control. If accepted, the document is patched, and the comment status updates to `resolved`.
   - **Mode 2 (Bulk Resolution):** A prominent **"Fix All Comments"** button at the top toolbar of the active document. Clicking this aggregates all open comments, packages them into a single context prompt, streams the combined proposed revisions to the chat, and updates the document upon Accept approval.
3. **Focused Chat Mode ("Chat-First" layout) with Compact Sidebar:**
   - A layout mode: `chat-focused`. The chat is centered in a high-fidelity container (`max-w-4xl` width, ~70% screen).
   - Sidebar and Document tab list remain **visible but compact** (collapsed to clean icons, maintaining quick-access routing without taking screen real estate).
   - Active files referenced in chat can be opened in a floating "Slide-Over Document Peek Panel" sliding from the right.
4. **Right-Click Sidebar Integration:**
   - Add a context menu action "Reference in Chat" on all file list items in the sidebar. This auto-appends `@fileName` to the active chat prompt text area.
5. **Telemetry & Metrics Tracking:**
   - Track comment creation events (`comment.created`) carrying the comment ID and file path.
   - Track comment resolution events (`comment.resolved`) carrying the comment ID, file path, and resolution source (`resolvedBy: 'user' | 'ai'`) to measure the ratio of comments opened by users vs. closed by the AI agent.

### Out of Scope
1. **Real-time Multiplayer Comments:** No collaborative web-sockets multiplayer commenting backend is required.
2. **Comment Threads/Nested Replies:** A simple flat structure (User Comment -> AI resolution -> Resolved status) is sufficient for MVP.
3. **Full PDF/Word Editing:** Commenting is strictly designed for Markdown documents (.md files) and artifacts.

---

## 4. Acceptance Criteria (Testable)

| ID | Feature | Test Scenario | Expected Result |
|---|---|---|---|
| AC-1 | Selection & Bubble | Select a sentence in the Tiptap editor. | A floating menu appears with "Add Comment" (alongside "Magic Edit"). |
| AC-2 | Comment Creation | Click "Add Comment", type "Add more metrics here", and save. | An elegant card appears in the editor's right margin, showing the comment. The selected text is highlighted, and the metadata is stored in `.metadata/comments/{fileId}.json` without polluting the markdown. |
| AC-3 | Single AI Resolution | Click "Ask AI to Resolve" on a single comment card. | The AI streams the proposed change to the chat. A card with "Accept" and "Reject" buttons appears. Clicking "Accept" patches the file and marks the comment as resolved. |
| AC-4 | Fix All Comments | Click the "Fix All Comments" button in the editor toolbar. | The AI aggregates all open comments, streams the combined proposed change to the chat with Accept/Reject controls, and updates the file upon user acceptance. |
| AC-5 | Chat-First Layout | Switch to "Focused Chat" view in the workspace layout. | The chat panel moves to the center (~70% width). The left sidebar and tabs compress into a compact, icon-only view. |
| AC-6 | File Peeking | Click an `@file` link in chat or in the prompt area. | A beautiful slide-over panel opens on the right side showing the file content. The chat input maintains its text and focus. |
| AC-7 | Right-Click Reference | Right-click a file in the sidebar and choose "Reference in Chat". | `@filename` is inserted at the cursor position in the active chat prompt box. |
| AC-8 | Accessibility | Navigate comments and compact chat via keyboard (Tab, Enter, Esc). | Aria attributes are correctly applied; contrast ratio meets WCAG AA standards. |

---

## 5. Edge Cases & Error Handling

1. **Broken Selection Anchors:** If the user edits the document manually and deletes the text containing the highlighted comment anchor, the comment should not crash the editor. It should gracefully fallback to a "Floating Project Comment" not bound to specific text.
2. **LLM Edit Failures:** If the AI fails to update the file, the comment should show an "AI Edit Failed" retry indicator and revert the document to its pre-edit state.
3. **Concurrent Edits:** If the user comments on a file while another AI workflow is writing to it, the application should lock the document tab or warn the user.
4. **Huge Files in Slide-Over:** The Peek panel must use virtual scrolling or a performant ScrollArea to avoid lagging when previewing very long markdown files.

---

## 6. Dependencies

1. **Tiptap Editor v2 Extensions:** Needs `@tiptap/extension-highlight` or a custom selection mark extension to anchor comments.
2. **Node.js Backend File Service:** Needs to support precise text replacement API or patch writing for markdown files when comments are resolved by the AI.
3. **Local/Cloud LLMs Capabilities:** The system prompt for AI providers needs to be enhanced to handle `EDIT_PATCH` commands or structured document edits.

---

## 7. Prioritized Implementation Slices

### Slice 1: MVP (Focused Chat, Compact Sidebar & Peeking)
- Implement `chat-focused` layout in `MainPanel.tsx` and `Workspace.tsx` (centered chat + compact sidebar).
- Create the Slide-Over `FilePeekPanel` component.
- Integrate `@file` link click events to trigger the slide-over preview.
- Add right-click "Reference in Chat" to sidebar files.

### Slice 2: Metadata Registry & Commenting UI
- Setup `.metadata/comments/` sidecar storage integration in Node backend.
- Implement text highlighting and Tiptap "Comment Mark" extension in `RichMarkdownEditor.tsx`.
- Create margin comment panels synced with selected text node coordinates.

### Slice 3: Single & Bulk AI Resolution Loops
- Implement "Ask AI to Resolve" streaming and Accept/Reject diff display in Chat.
- Implement "Fix All Comments" bulk action button and aggregated LLM streaming workflow.
- Validate dark and light themes for all new elements.

---

## 8. API / Contract Assumptions

### 1. Comments Fetch/Save
- **Endpoint:** `GET /api/projects/:projectId/files/:filePath/comments`
- **Response:**
```json
{
  "comments": [
    {
      "id": "c1",
      "text": "Clarify latency vs throughput metrics",
      "anchorText": "high throughput across the cluster",
      "anchorIndex": 1240,
      "status": "open",
      "createdAt": "2026-05-28T12:00:00Z"
    }
  ]
}
```

### 2. Single/Bulk Patch Preview
- **Endpoint:** `POST /api/projects/:projectId/files/patch-preview`
- **Request Body:**
```json
{
  "filePath": "artifacts/prd_feature_x.md",
  "patches": [
    {
      "commentId": "c1",
      "commentText": "Clarify latency vs throughput metrics",
      "anchorText": "high throughput across the cluster"
    }
  ]
}
```
