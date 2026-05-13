# Backend Implementation Plan: Chat Stabilization

## Goal
Implement streaming, fix trace logging, and enable request cancellation.

## Proposed Changes

### [orchestrator.mjs](file:///node-backend/lib/orchestrator.mjs)
- Maintain a map of active `AbortController`s per session (or a single active one for the orchestrator if only one concurrent chat is allowed).
- Pass `signal` to `provider.chat`.
- Implement `stopExecution()` method to abort the active controller.

### [providers/base.mjs](file:///node-backend/lib/providers/base.mjs)
- Update `chat` method signature to accept an options object containing `signal` and `onDelta` callback.

### [providers/hosted.mjs](file:///node-backend/lib/providers/hosted.mjs)
- Use `fetch` with `stream: true`.
- Implement a reader to process the stream and call `onDelta`.
- Pass `signal` to `fetch`.

### [server.mjs](file:///node-backend/server.mjs)
- Add `POST /api/chat/stop` route.
- Call `orchestrator.stopExecution()`.
- Ensure `runAgentLoop` passes a `onDelta` callback that broadcasts `chat-delta` events via SSE.

## API Spec
- `POST /api/chat/stop`: Cancels the current agent execution. Returns 204 No Content.
- `chat-delta` (SSE event): Emits chunks of text as they arrive from the LLM.

## Performance Considerations
- Streaming reduces perceived latency significantly.
- SSE is efficient for real-time updates.

## Observability
- Add trace logs for "Streaming started", "Chunk received", "Execution aborted".
