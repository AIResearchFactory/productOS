# Frontend Implementation Plan: Chat Stabilization

## Goal
Support chat streaming and reliable trace logging.

## Proposed Changes

### [TraceLogs.tsx](file:///src/components/workspace/TraceLogs.tsx)
- Change logic to buffer logs even when the panel is closed.
- Maintain a local log history in a context or a higher-level state if possible, or just remove the `isOpen` check in the listener.

### [ChatPanel.tsx](file:///src/components/workspace/ChatPanel.tsx)
- The existing `chat-delta` listener is already present but may need verification.
- Ensure `handleSend` correctly initializes the assistant message for streaming.
- Ensure `handleStop` calls the (now fixed) backend endpoint.

### [api/server.ts](file:///src/api/server.ts)
- Verify `stopAgentExecution` hits the correct `/api/chat/stop` endpoint.

## Responsive Behavior
- No changes needed; existing UI is already responsive.

## Risks
- SSE connection limits in some browsers (using a `SharedEventSource` as seen in `runtime.ts` should mitigate this).
