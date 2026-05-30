# Backend Implementation Plan - AI Chat & Knowledge Workspace Alignment

**Feature Name:** Contextual Comments & Focused Chat API  
**Status:** Under Review  
**Date:** May 28, 2026  
**Stage:** Backend Planning Phase (Stage 4 of the Feature Development Pipeline)

---

## 1. API Specifications

We will implement new API endpoints in the Node.js backend (`node-backend/server.mjs` and related helper files) under the primary `/api/` prefix.

### 1. Retrieve Document Comments
- **Endpoint:** `GET /api/projects/:projectId/files/:filePath/comments`
- **Path Parameters:**
  - `projectId`: The unique ID of the active project.
  - `filePath`: The relative file path to the target document.
- **Headers:** `Content-Type: application/json`
- **Response Codes:**
  - `200 OK` (Comments loaded successfully)
  - `400 Bad Request` (Missing path parameters)
  - `404 Not Found` (Project or file registry not found)
- **Response Payload:**
```json
{
  "comments": [
    {
      "id": "comment_1715000000",
      "text": "Add visual chart here demonstrating CWV performance changes",
      "anchorText": "Our primary metric is cumulative layout shift.",
      "anchorIndex": 540,
      "status": "open",
      "createdAt": "2026-05-28T14:30:00.000Z",
      "author": "User"
    }
  ]
}
```

### 2. Add / Update Comments
- **Endpoint:** `POST /api/projects/:projectId/files/:filePath/comments`
- **Path Parameters:**
  - `projectId`: The unique ID of the active project.
  - `filePath`: The relative file path to the target document.
- **Request Body:**
```json
{
  "comments": [
    {
      "id": "comment_1715000000",
      "text": "Add visual chart here demonstrating CWV performance changes",
      "anchorText": "Our primary metric is cumulative layout shift.",
      "anchorIndex": 540,
      "status": "resolved",
      "createdAt": "2026-05-28T14:30:00.000Z",
      "author": "User"
    }
  ]
}
```
- **Response Codes:**
  - `200 OK` (Registry successfully updated)
  - `400 Bad Request` (Missing path parameters)
  - `500 Internal Server Error` (Failed writing metadata)

### 3. Ask AI to Resolve (Patch Preview Generation)
- **Endpoint:** `POST /api/projects/:projectId/files/patch-preview`
- **Request Body:**
```json
{
  "filePath": "path/to/file.md",
  "patches": [
    {
      "commentId": "comment_1715000000",
      "commentText": "Add visual chart here demonstrating CWV performance changes",
      "anchorText": "Our primary metric is cumulative layout shift."
    }
  ]
}
```
- **Behavior:**
  - Invokes the active AI provider (Claude, Gemini, etc.) using a structured system prompt.
  - Passes the full document content, selection anchors, and comment texts.
  - Instructs the model to output a structured inline replacement for the selected anchor tags, showing side-by-side modifications.
  - Streams the proposed replacements back to the chat response client via Server-Sent Events (SSE) `chat-delta`.

---

## 2. Data Model & Registry Storage

- **Registry Root:** Comments will be stored inside the OS-specific app data project folder:
  - `{PROJECT_DIR}/.metadata/comments/`
  - Filename mapping: Path names will be sanitized (e.g., `presentations/my_file.md` maps to a JSON file `{PROJECT_DIR}/.metadata/comments/presentations__my_file.json`).
- **Data Preservation:** Keeping comments inside `.metadata/comments/` preserves standard clean Markdown inside user-facing project folders. Standard imports/exports ignore the `.metadata/` folder.

---

## 3. Validation & Business Rules

1. **Self-Healing Indexing:** When comments are fetched via `GET`, the backend validates if the anchor text matches the characters at the specified `anchorIndex` inside the markdown file. If the offsets don't match (e.g., because of manual, external file modification), the backend executes an inline search to recompute the correct index and updates the JSON registry automatically.
2. **State Updates:** Resolving a comment moves its status tag from `'open'` to `'resolved'`, but retains the record for historical search and context tracking by the AI.

---

## 4. Performance Considerations

- **Caching:** Comments JSON files are loaded on-demand and kept small (~few KB). Minimal memory overhead.
- **Bulk Edits Rate-limiting:** Combined resolutions (e.g. "Fix All Comments") batch multiple LLM operations into one prompt to avoid provider throttling.

---

## 5. Observability (Trace Logs)

- Add log tags `[CommentsRegistry]` and `[PatchEngine]` displaying exact comments loaded, resolved, or search mismatch healing operations inside trace logs.

---

## 6. Backward Compatibility

- Existing projects without `.metadata/comments/` folders are supported gracefully (empty array fallback).

---

## 7. Telemetry Endpoint Support

- The backend telemetry route `POST /api/telemetry/event` receives comment created and resolved events sent by the client.
- The telemetry service validates, parses, and logs comments activity statistics into the local developer analytics store (`{PROJECT_DIR}/.metadata/telemetry_events.json`), enabling accurate user-behavior performance auditing.

