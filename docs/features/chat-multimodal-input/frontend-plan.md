# Frontend Implementation Plan: Chat Multimodal Input (v0.5.1)

> **Feature**: `chat-multimodal-input`  
> **Target Version**: `v0.5.1`  
> **Status**: Draft — Ready for Review  
> **Pipeline Stage**: Frontend Agent -> QA & Unit Test Agents  
> **Reference Specs**: [prd.md](./prd.md) &bull; [ux-spec.md](./ux-spec.md)  

---

## 1. Executive Summary

This plan specifies all frontend TypeScript interfaces, API client updates, React hooks, workspace components, settings controls, and global browser drag-drop guards required to deliver temporary image references and hybrid voice-to-text input without bloating `ChatPanel.tsx` (currently 3,269 lines).

---

## 2. File Inventory & Component Plan

```
src/
├── App.tsx                                          [MODIFY] Global window dragover/drop guard (prevent tab takeover)
├── api/
│   ├── contracts.ts                                 [MODIFY] Attachment, Voice, CustomCLI.supportsImages, ResearchLogEntry types
│   ├── server.ts                                    [MODIFY] chatApi voice capabilities, transcribe, vision capability check
│   └── runtime.ts                                   [MODIFY] Pass-through wrappers on runtimeApi / appApi
├── lib/
│   └── visionCapabilities.ts                        [NEW] Pure capability resolver (supported | unsupported | unverified)
├── hooks/
│   ├── useChatAttachments.ts                        [NEW] Validation, canvas downscaling, base64 prep, ObjectURL lifecycle
│   └── useVoiceInput.ts                             [NEW] Hybrid Web Speech API + MediaRecorder STT state machine
├── components/
│   ├── workspace/
│   │   ├── ChatPanel.tsx                            [MODIFY] Integrate attachments, voice, queue/retry preservation, project-switch reset
│   │   ├── ChatAttachmentStrip.tsx                  [NEW] Thumbnails, pending/loading spinner, error/warning badges, queued badges
│   │   ├── ChatDropOverlay.tsx                      [NEW] Drag-counter-safe drop overlay (hidden-mode aware)
│   │   ├── VoiceRecorderButton.tsx                  [NEW] Mic toggle, recording bar, timer, locale switcher, unsupported tooltip
│   │   └── ResearchLog.tsx                          [MODIFY] Render lightweight attachment count + filenames at top of entry
│   └── settings/
│       ├── ProviderSettings.tsx                     [MODIFY] Add "Supports Images (CLI)" toggle inside Custom Model CLI cards
│       └── ModelSettings.tsx                        [MODIFY] Add "Voice-to-Text (Speech Input)" fallback & unsupported guidance UI
└── pages/
    ├── GlobalSettings.tsx                           [MODIFY] Ensure voiceCapabilities fetch & Settings propagation
    └── ProjectSettings.tsx                          [MODIFY] Ensure existing PPTX drop zone calls e.stopPropagation() cleanly
```

---

## 3. State & Event Model

### 3.1 `PendingImageAttachment` & `useChatAttachments`
- **State item**:
  ```ts
  export interface PendingImageAttachment {
    id: string;
    name: string;
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
    sizeBytes: number;
    previewUrl: string;
    dataUrl?: string;
    width?: number;
    height?: number;
    status: 'processing' | 'ready' | 'error';
    error?: string;
  }
  ```
- **Limits & Processing**:
  - Max `4` images per message; max `10 MB` raw input per image; allowed types: `image/png`, `image/jpeg`, `image/webp`, `image/gif`.
  - Runs async canvas resize when `Math.max(width, height) > 2048` while `status === 'processing'` (showing the loading spinner on the thumbnail in `ChatAttachmentStrip`).
  - Produces `dataUrl` once ready; tracks all created `previewUrl`s in a `Set<string>` ref so `URL.revokeObjectURL()` runs deterministically on:
    1. Individual thumbnail removal
    2. Turn dispatch/clear (after converting to lightweight metadata for live view or after turn completes)
    3. `activeProject?.id` change (prevents data leakage across projects)
    4. Component unmount / `beforeunload`

### 3.2 `messageQueue`, `handleRetry`, & `socraticState` Upgrade in `ChatPanel.tsx`
- Upgrade `messageQueue` from `string[]` to:
  ```ts
  interface QueuedChatItem {
    id: number;
    text: string;
    attachments?: ChatImageAttachmentPayload[];
  }
  ```
- **Live vs Queued Display**:
  - When `handleSend` runs (or queues), attached images render as a compact thumbnail row with a subtle `Pending` indicator while `status === 'sending'` or queued.
  - Once the turn completes (`status === 'success'`), base64 data URLs can be dropped from React state in favor of the lightweight metadata summary (`attachmentMeta`) so memory stays lean and matches saved `chats/*.md` behavior—while keeping `attachments` on `status === 'error'` messages solely for `handleRetry` within that live session!
- **Empty-Text Send**:
  - Send button enabled whenever `(input.trim().length > 0 || readyAttachments.length > 0) && visionStatus !== 'unsupported' && !hasProcessingAttachments`.
  - If `input.trim()` is empty and `readyAttachments.length > 0`, `handleSend` uses `"Please analyze the attached image(s)."` as the prompt text sent to the backend.
- **Socratic Bypass**:
  - When `attachments.length > 0`, skip `socraticApi.detectIntent` or preserve attachments cleanly so images are never stripped before reaching `appApi.sendMessage`.

### 3.3 `useVoiceInput` State Machine
```ts
type VoiceInputStatus =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'transcribing'
  | 'unsupported'
  | 'error';
```
- **Capability Detection**:
  - Checks `typeof window !== 'undefined' && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)`.
  - Fetches `chatApi.getVoiceCapabilities()` on mount and when `productos:settings-changed` fires.
  - Resolves `effectiveMode`:
    - `'web-speech'` when Web Speech API is supported in the browser (and user hasn't explicitly forced fallback).
    - `'backend-fallback'` when Web Speech API is unavailable AND (`fallbackProviders.openAi || fallbackProviders.gemini || fallbackProviders.localWhisper`) AND `settings.voiceInput?.fallbackProvider !== 'none'`.
    - `'unsupported'` when Web Speech API is unavailable AND no fallback provider is configured/enabled (e.g., Firefox with no OpenAI / AGY-Gemini / Whisper).
- **Locale & Language Switcher**:
  - Initializes `language` to `settings.voiceInput?.language || navigator.language || 'en-US'`.
  - Offers curated quick locales (`Browser Default`, `en-US`, `en-GB`, `he-IL`, `es-ES`, `fr-FR`, `de-DE`, `ja-JP`, `zh-CN`) via a compact popover/select on `VoiceRecorderButton`; updates persisted preference or session locale cleanly.
- **Recording & Teardown**:
  - In `web-speech` mode: emits live `interimTranscript` while recording; on Stop, invokes `onTranscriptReady(finalText)` which inserts/appends into `ChatPanel`'s `input` state without auto-sending.
  - In `backend-fallback` mode: records via `MediaRecorder` (`audio/webm;codecs=opus` -> fallback `audio/mp4` / `audio/webm`); on Stop, encodes Blob to base64 in memory, sets `status = 'transcribing'`, calls `chatApi.transcribeAudio(...)`, inserts returned `{ text }` into `input` state, and drops audio buffer immediately.
  - `cleanup()` runs on Stop, Cancel, `activeProject?.id` change, and hook unmount: aborts `SpeechRecognition`, stops `MediaRecorder`, and invokes `track.stop()` on every `MediaStreamTrack`.

### 3.4 Global Drag-and-Drop Isolation (`App.tsx` + `ChatPanel.tsx` + `ProjectSettings.tsx`)
- In `App.tsx` (`useEffect` at root):
  - Listen on `window` for `dragover` and `drop` (bubble phase).
  - Whenever `e.dataTransfer?.types?.includes('Files')`: call `e.preventDefault()`; if `e.defaultPrevented` wasn't already handled by an active zone (or track via `e.dataTransfer.dropEffect`), force `e.dataTransfer.dropEffect = 'none'` unless an active drop zone explicitly set `'copy'`.
- In `ChatPanel.tsx`:
  - Only attach active `dragenter`/`dragover`/`dragleave`/`drop` acceptance when `layoutMode !== 'hidden'`.
  - When `layoutMode === 'hidden'`, do **not** call `stopPropagation()` and do **not** accept drops (because `MainPanel.tsx` keeps `ChatPanel` mounted with `pointer-events-none opacity-0`).
  - When `layoutMode` is `'split'` or `'chat-focused'` and drag contains files, call `e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'`, increment `dragCounterRef` on `dragenter`, decrement on `dragleave`, reset to `0` on `drop`.
- In `ProjectSettings.tsx`:
  - Ensure `onDragOver` and `onDrop` on the PPTX template dropzone call `e.stopPropagation()` and set `dropEffect = 'copy'`.

### 3.5 Vision Capability Resolver (`src/lib/visionCapabilities.ts`)
Resolves `{ status: 'supported' | 'unsupported' | 'unverified', reason?: string }` from `(activeProvider, globalSettings, activeOllamaVisionCheck)`:
- `hostedApi`: check configured `hosted.model` against known text-only vs vision families (modern Claude 3+/4+, GPT-4o/4.1/o1/o3/5+, Gemini 1.5/2.x/3.x -> `'supported'`; legacy text-only like `gpt-3.5`, `text-davinci`, `o1-mini` -> `'unsupported'`).
- `geminiCli` (`agy`/`gemini`): `'supported'` (unless an explicitly text-only alias like `gpt-oss` is selected -> `'unsupported'`).
- `claudeCode`, `openAiCli`: `'supported'`.
- `ollama`: query `/api/chat/vision/check?model=<model>` (which inspects Ollama `/api/show` `capabilities` / `details.families`) paired with known vision prefixes (`llava`, `bakllava`, `minicpm-v`, `moondream`, `qwen2.5vl`, `qwen2-vl`, `llama3.2-vision`, `gemma3`, `mistral-small3.1`, `granite3.2-vision`); if confirmed text-only (e.g., `llama3`, `mistral`, `deepseek-r1`) -> `'unsupported'` (renders **red error badge** and blocks Send).
- `custom-*`: if `cli.supportsImages === true` -> `'supported'` (no warning badge!); otherwise -> `'unverified'` (renders **amber warning badge** with tooltip pointing to **Settings -> AI & Models -> Custom Model CLIs**).
- `autoRouter`: evaluate routed target (`localProvider` / `cloudProvider` according to `modelRouter.mode`).

---

## 4. API Contract Usage (`src/api/contracts.ts`, `server.ts`, `runtime.ts`)

- `chatApi.sendMessage(messages, projectId?, skillId?, skillParams?, providerType?, signal?)` — sends `messages` including `attachments` on user messages; uses existing `600000` ms timeout and `retryOnFetchFailure: false`.
- `chatApi.getVoiceCapabilities()` — `GET /api/chat/voice/capabilities` returning `VoiceCapabilities`.
- `chatApi.transcribeAudio(payload: { audioBase64: string; mimeType: string; language?: string; preferredProvider?: string })` — `POST /api/chat/transcribe` returning `{ text: string; provider: string }`.
- `chatApi.getVisionCapabilities(provider: string, model?: string)` — `GET /api/chat/vision/check` returning `{ status: 'supported' | 'unsupported' | 'unverified'; reason?: string }`.

---

## 5. Responsive Behavior & Risks

- **Narrow `split` View (`~360px` width)**: Composer uses a 2-tier layout inside the existing input wrapper:
  1. Optional `ChatAttachmentStrip` row (`flex gap-2 overflow-x-auto pb-2`).
  2. `<Textarea>` with bottom action bar or compact inline controls (`Attach`, `Mic`, `Locale` chip on the left; `Send` on the right) so placeholder text never collides with action icons.
- **Chat-Focused Mode (`max-w-4xl`)**: `ChatDropOverlay` aligns cleanly inside the rounded `max-w-4xl` container without overflowing rounded corners.
- **Browser CSP**: All backend transcription calls target `http://127.0.0.1:*` / `http://localhost:*` already permitted in `index.html`. Do NOT call third-party OpenAI/Gemini APIs directly from the browser.

---

## 6. PR-Ready Checklist

- [ ] `App.tsx` global drag guard blocks non-chat file drops without breaking `ProjectSettings.tsx` PPTX dropzone.
- [ ] `ChatPanel.tsx` accepts Add button, Drag & Drop (`split` + `chat-focused`), and `Cmd/Ctrl+V` paste; disabled when `layoutMode === 'hidden'`.
- [ ] Thumbnail previews show loading spinner while processing/queued, red error badge on non-vision models, amber warning badge on unverified Custom CLIs.
- [ ] `ProviderSettings.tsx` exposes `"Supports Images (CLI)"` switch per Custom CLI, clearing the chat warning when enabled.
- [ ] `ModelSettings.tsx` exposes **Voice-to-Text** fallback provider selector (OpenAI / AGY-Gemini / Whisper) and unsupported Firefox guidance.
- [ ] `useVoiceInput.ts` defaults to `navigator.language`, offers locale switcher, inserts editable text before send, and stops all tracks on stop/cancel/switch/unmount.
- [ ] `ResearchLog.tsx` renders attachment count + filenames at top of entry and renders voice messages identically to typed messages.
- [ ] `npm run build` (`tsc && vite build`) compiles cleanly with `strict: true` and zero errors.

---

## Standard Handoff Contract

- **Summary**: Specified frontend file inventory, hooks (`useChatAttachments`, `useVoiceInput`), components (`ChatAttachmentStrip`, `ChatDropOverlay`, `VoiceRecorderButton`), settings UI (`ProviderSettings`, `ModelSettings`), global drag-drop guard, queue/retry attachment preservation, and API client additions.
- **Decisions made**: Extracted all new attachment/voice logic out of `ChatPanel.tsx` into modular hooks/components; normalized canvas downscaling (`<= 2048px`) client-side; delegated third-party STT calls to backend `/api/chat/transcribe` to obey CSP and keep API keys encrypted in backend secrets.
- **Open risks**: React `Textarea` height + multi-icon overlap on narrow panels (mitigated by reserving dedicated bottom/side padding inside the composer shell); browser `SpeechRecognition` differences between Chrome and Safari (mitigated by clean error-to-fallback transitions).
- **Artifacts produced**: `docs/features/chat-multimodal-input/frontend-plan.md`.
- **Handoff to next agent**: Coordinate API payloads and error shapes with Backend Agent (`backend-plan.md`), then verify via QA/Unit/E2E plans.
- **Blockers**: None.
