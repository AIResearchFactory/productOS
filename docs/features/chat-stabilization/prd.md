# PRD: Chat Performance & Control Stabilization

## Problem Statement
The AI chat experience is currently degraded by two major issues:
1. **High Latency & Poor Feedback**: AI responses take upwards of 40 seconds because the system waits for the full response instead of streaming. Additionally, trace logs (which provide visibility into the agent's "thinking" process) are often missing or not captured correctly in the UI.
2. **Broken Cancellation**: The "Stop Thinking" button does not function because the backend route is missing and the orchestrator lacks a cancellation mechanism.

## User Stories
- As a user, I want to see the AI's response as it's being generated (streaming) so that I don't have to wait 40+ seconds to see if it's on the right track.
- As a user, I want to see real-time trace logs of the agent's actions so I know it hasn't crashed during long operations.
- As a user, I want to be able to stop the AI's thinking process immediately if I realize I made a mistake in my prompt or if it's going in the wrong direction.

## Scope
### In-Scope
- Implementation of streaming for at least the `Hosted API` provider (and others if possible).
- Real-time broadcasting of chat chunks from backend to frontend.
- Backend implementation of `/api/chat/stop` endpoint.
- Cancellation logic in `AgentOrchestrator` using `AbortController`.
- Fix for `TraceLogs` component to ensure logs are captured reliably.

### Out-of-Scope
- Major UI overhaul of the Chat Panel.
- Implementation of streaming for all 3rd party CLI-based providers (unless they support it easily via stdout).

## Acceptance Criteria
- AI responses start appearing in the chat within a few seconds of sending a prompt.
- Trace logs appear in the log panel as the agent progresses through its loop.
- Clicking "Stop Thinking" immediately terminates the backend request and updates the UI state to allow a new prompt.
- The "Stop Thinking" button works for both standard chat and long-running agent tasks.

## Edge Cases
- User clicks "Stop Thinking" just as the response finishes.
- Connection drop during streaming.
- SSE connection failure preventing logs from showing up.

## Dependencies
- Node.js backend (`server.mjs`, `orchestrator.mjs`).
- React frontend (`ChatPanel.tsx`, `TraceLogs.tsx`).

## Prioritized Implementation Slices
1. **MVP**: Implement `/api/chat/stop` and `AbortController` cancellation in backend. Fix Trace Log capture logic.
2. **V1**: Enable streaming in `HostedAPIProvider` and `orchestrator.runAgentLoop`.
3. **V2**: Implement streaming for other providers (Ollama, Gemini, etc.).
