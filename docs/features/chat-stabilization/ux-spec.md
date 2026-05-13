# UX Spec: Chat Streaming & Control

## User Flow: Chatting with Streaming
1. User enters a prompt in `ChatPanel`.
2. User clicks "Send".
3. Assistant message appears immediately with a "thinking" pulse.
4. (New) Text chunks begin appearing in the message bubble in real-time.
5. "Stop Thinking" button is visible during the entire generation process.
6. Generation finishes; "thinking" pulse disappears; "Stop Thinking" button disappears.

## User Flow: Stopping Thinking
1. User clicks "Stop Thinking" while generation is in progress.
2. (New) Backend is signaled to abort.
3. Message bubble shows "Generation cancelled by user" or simply stops at current state.
4. UI resets to "Ready" state (input enabled, loading spinner gone).

## Screen States
- **Loading (Streaming)**: Text is being added incrementally. A cursor or pulse indicates progress.
- **Cancelled**: The message ends abruptly, possibly with a visual indicator that it was stopped.
- **Error**: If streaming fails, show a descriptive error in the trace logs and a fallback in the chat.

## Interaction Notes
- **Scrolling**: The chat should auto-scroll to the bottom as new chunks arrive, unless the user has manually scrolled up.
- **Responsiveness**: The "Stop Thinking" button must be highly responsive and always visible during long generations.

## Handoff Annotations
- Use `SSE` (Server-Sent Events) to stream both trace logs and chat deltas.
- Frontend should listen for `chat-delta` events and append to the active message.
- `Stop Thinking` should trigger a `POST /api/chat/stop` call.
