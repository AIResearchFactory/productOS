# E2E Test Plan: Chat Multimodal Input (v0.5.1)

> **Feature**: `chat-multimodal-input`  
> **Target Version**: `v0.5.1`  
> **Status**: Draft — Ready for Review  
> **Pipeline Stage**: E2E Test Agent -> Implementation & CI Execution  
> **Reference Specs**: [qa-plan.md](./qa-plan.md) &bull; [unit-test-plan.md](./unit-test-plan.md)  

---

## 1. Executive Summary & Test File Inventory

This plan defines the Playwright End-to-End (E2E) test suite for **Chat Multimodal Input (`v0.5.1`)**, validating every browser interaction (Add button, Drag & Drop, Clipboard Paste, global tab-takeover protection, vision indicators, project-switch cleanup, voice dictation, fallback transcription, and Firefox unsupported UI) against the real Node backend and built Vite UI.

```
e2e/
└── chat-multimodal-input.spec.ts    [NEW] Comprehensive E2E suite for image attachments & voice input
```

---

## 2. Selector (`data-testid`) Contract

To keep Playwright tests deterministic and decoupled from Tailwind CSS utility classes, implementation MUST expose:
- `chat-attach-image-btn` — Attach image button in composer
- `chat-attach-image-input` — Hidden `<input type="file">`
- `chat-drop-overlay` — Drag-over overlay inside `ChatPanel`
- `chat-attachment-strip` — Staged thumbnail container above textarea
- `chat-attachment-item` — Individual staged thumbnail card (with `data-status="processing|ready|error"`, `data-vision-state="supported|unverified|unsupported"`)
- `chat-attachment-remove` — Remove (`X`) button on staged thumbnail
- `chat-attachment-pending` — Pending/loading spinner indicator
- `chat-attachment-warning` — Amber warning badge (unverified Custom CLI)
- `chat-attachment-error` — Red error badge (non-vision model)
- `chat-voice-btn` — Microphone button (`data-voice-state="idle|recording|transcribing|unsupported"`)
- `chat-voice-recording-bar` — Active recording timer + Stop/Cancel bar
- `chat-voice-stop-btn` / `chat-voice-cancel-btn`
- `chat-voice-locale-select` — Compact dictation language switcher
- `research-log-attachments` — Attachment summary badge/line on Research Log entries
- `settings-custom-cli-supports-images` — Switch inside Custom Model CLIs card
- `settings-voice-fallback-select` & `settings-voice-unsupported-banner` — Controls in Settings -> AI & Models

---

## 3. E2E Scenarios (`e2e/chat-multimodal-input.spec.ts`)

### Scenario 1: Image Attach via Button, Empty-Text Send & Research Log Verification (Happy Path)
1. Boot app against isolated test `PROJECTS_DIR` with a mocked/local test provider route or deterministic mock CLI provider; reach active project workspace.
2. Click `chat-attach-image-btn` and set files on `chat-attach-image-input` with a valid PNG (`slide-1.png`).
3. Assert `chat-attachment-strip` displays thumbnail for `slide-1.png`.
4. Leave `chat-input` empty; click `chat-send`.
5. Assert backend receives prompt with `"Please analyze the attached image(s)."` and image payload; assert assistant replies cleanly.
6. Assert Project File Tree in Sidebar does **not** include `slide-1.png` (confirming non-import).
7. Assert `.metadata/.tmp-chat/` on disk is empty after the turn finishes.
8. Open **Project Log** (`ResearchLog`); assert `research-log-attachments` shows `1 attachment: slide-1.png` at the top of the entry.

### Scenario 2: Drag & Drop (`split` + `chat-focused`) & Clipboard Paste (`Cmd/Ctrl+V`)
1. In `split` layout: dispatch synthetic `DataTransfer` `dragenter` -> `dragover` -> `drop` with an image `File` onto `ChatPanel`; assert `chat-drop-overlay` appears during drag and thumbnail stages on drop.
2. Switch to `chat-focused` layout mode; drag & drop a second image; assert staged count becomes 2.
3. Focus `chat-input` and dispatch a `paste` event carrying an image `File` in `clipboardData`; assert staged count becomes 3.

### Scenario 3: Global Browser Drop Guard & Hidden Chat Isolation + PPTX Regression
1. Record initial `page.url()`.
2. Drag & drop an image `File` onto the Markdown Editor / Main area outside `ChatPanel`:
   - Assert `page.url()` did NOT change to `file://` or `blob:`.
   - Assert `chat-attachment-strip` remains empty.
3. Toggle Chat to `hidden` (`layoutMode === 'hidden'`), dispatch a `drop` event over the right side of the window:
   - Assert no navigation occurs and no image is attached.
4. Navigate to **Project Settings** -> Brand Design PPTX dropzone; drag & drop a sample `.pptx` payload -> assert existing PPTX dropzone still receives the drop (regression guard).

### Scenario 4: Vision Model Error Badge & Custom CLI Manual Override
1. Switch active provider to `ollama` configured with `llama3` (text-only):
   - Stage an image -> assert `chat-attachment-error` red badge renders and `chat-send` is disabled.
2. Switch to a Custom CLI provider:
   - Stage an image -> assert `chat-attachment-warning` amber badge renders while `chat-send` remains enabled.
3. Open **Settings -> AI & Models -> Custom Model CLIs**, enable `settings-custom-cli-supports-images`, save settings, return to Workspace:
   - Assert `chat-attachment-warning` is gone for that Custom CLI.

### Scenario 5: Project Switch Temp-File Cleanup
1. Create two projects (`Alpha`, `Beta`).
2. In `Alpha`, stage an image (`alpha-secret.png`); send a slow mock CLI turn or keep staged.
3. Switch active project to `Beta`:
   - Assert `chat-attachment-strip` clears immediately in `Beta`.
   - Assert `Alpha/.metadata/.tmp-chat/` contains zero lingering files.

### Scenario 6: Voice-to-Text Dictation (Web Speech Mock), Locale Switch & Plain-Text Logging
1. Use `page.addInitScript()` to inject a deterministic `window.SpeechRecognition` mock.
2. Open `chat-voice-locale-select`, confirm default matches browser locale, switch to `en-GB`.
3. Click `chat-voice-btn`; verify `chat-voice-recording-bar` is visible and mock receives `lang === 'en-GB'`.
4. Emit simulated speech result (`"Summarize competitor pricing from Q3"`), click `chat-voice-stop-btn`.
5. Assert `chat-input` now contains `"Summarize competitor pricing from Q3"` (NOT auto-sent).
6. Edit text in `chat-input` (`"...and compare tiers"`), click `chat-send`.
7. Assert chat message and `ResearchLog` contain the edited plain text with **no** voice badge and **no** audio files on disk.

### Scenario 7: Hybrid Fallback & Unsupported Browser (Firefox Simulation)
1. Remove `window.SpeechRecognition` and `window.webkitSpeechRecognition` via `page.addInitScript()`.
2. **Case A — No OpenAI or AGY/Gemini configured**:
   - In `ChatPanel`, assert `chat-voice-btn` has `data-voice-state="unsupported"` and shows Chrome / AGY / OpenAI suggestion.
   - In **Settings -> AI & Models**, assert `settings-voice-unsupported-banner` is visible.
3. **Case B — OpenAI/AGY fallback configured**:
   - Mock `navigator.mediaDevices.getUserMedia` + `MediaRecorder` + backend `/api/chat/transcribe`.
   - Click `chat-voice-btn` -> Stop -> assert transcribed text populates `chat-input` for editing before send.

---

## 4. Stability, CI Runtime & Flakiness Mitigation

- **Zero Hardware Dependencies**: Headless Chromium in Ubuntu CI lacks a microphone; `page.addInitScript` stubs `SpeechRecognition`, `navigator.mediaDevices.getUserMedia`, and `MediaRecorder` cleanly with synchronous track-stop tracking so we can even assert `track.stop()` was invoked!
- **Drag-Drop Determinism**: Playwright tests synthesize `DataTransfer` via `page.evaluateHandle` rather than OS file-manager drags, eliminating X11/Wayland drag flakiness.
- **CI Runtime Impact**: Estimated `+25–35s` across 7 focused tests inside 1 new spec file (`e2e/chat-multimodal-input.spec.ts`), running safely in the single Ubuntu Playwright job in `.github/workflows/test.yml`.
- **Fail-Fast Triage**: Every scenario logs assertions via Playwright traces (`retain-on-failure`); backend `.metadata/.tmp-chat/` checks verify exact file paths via `fs` assertions in Node test context.

---

## Standard Handoff Contract

- **Summary**: Authored Playwright E2E test plan covering all image input methods, global tab-takeover protection, PPTX dropzone regression, non-vision error & Custom CLI override, project-switch cleanup, Web Speech dictation with locale switching, and Firefox unsupported/fallback flows.
- **Decisions made**: Standardized `data-testid` attributes across new composer and Settings elements; mocked `SpeechRecognition` and `MediaRecorder` via `addInitScript` for headless Ubuntu CI reliability.
- **Open risks**: Synthetic `DragEvent` `dataTransfer.files` behavior in Chromium requires constructing `DataTransfer` inside `evaluateHandle` with a real `File` instance—documented in stability rules.
- **Artifacts produced**: `docs/features/chat-multimodal-input/e2e-plan.md`.
- **Handoff to next agent**: DevOps Agent to produce `release-plan.md` covering version bump `v0.5.1`, CI gates, docs checklist, rollout, and rollback.
- **Blockers**: None.
