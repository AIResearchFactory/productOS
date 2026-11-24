# Unit Test Plan: Chat Multimodal Input (v0.5.1)

> **Feature**: `chat-multimodal-input`  
> **Target Version**: `v0.5.1`  
> **Status**: Draft — Ready for Review  
> **Pipeline Stage**: Unit Test Agent -> Implementation & CI Verification  
> **Reference Specs**: [qa-plan.md](./qa-plan.md) &bull; [backend-plan.md](./backend-plan.md) &bull; [frontend-plan.md](./frontend-plan.md)  

---

## 1. Executive Summary & Test Runner Strategy

All backend unit/integration tests use Node's native test runner (`node --test`), matching `package.json`'s `npm test` script:
- `node-backend/tests/*.test.mjs`
- `tests/*.test.mjs`

Every test sets isolated temp `HOME` / `APP_DATA_DIR` / `PROJECTS_DIR` directories with `NODE_ENV=test` (never touching user data) and tears down cleanly before removing temp folders.

---

## 2. Test Suite Inventory

```
node-backend/tests/
├── temp-attachments.test.mjs          [NEW] Validation, magic bytes, materialization, 4-point cleanup
├── multimodal-providers.test.mjs      [NEW] Provider payload formatting + orchestrator sanitization
├── transcription.test.mjs             [NEW] Voice capabilities matrix + OpenAI/Gemini/Whisper fallback
└── research-log.test.mjs              [MODIFY] Add attachment header formatting & parsing assertions

tests/
└── vision-capabilities.unit.test.mjs  [NEW] Vision status matrix, Ollama non-vision, Custom CLI toggle
```

*(Note: verify `package.json`'s `npm test` glob `tests/*.test.mjs` picks up `tests/vision-capabilities.unit.test.mjs` automatically.)*

---

## 3. Module-by-Module Test Specifications

### 3.1 `node-backend/tests/temp-attachments.test.mjs`
- **Test 1 — Magic-Byte & MIME Validation**:
  - Valid PNG, JPEG, WebP, and GIF buffers pass.
  - Text payload disguised as `image/png` fails with `400`.
  - Exceeding 4 images or 10 MB decoded size fails with `400`.
  - Filename `../../secret/slide?.png` sanitizes to safe basename `slide_.png`.
- **Test 2 — Materialization Scope**:
  - With active `projectPath`: writes strictly inside `{projectPath}/.metadata/.tmp-chat/{runId}/`.
  - Without `projectPath`: writes inside `{os.tmpdir()}/productos-chat-tmp/{runId}/`.
- **Test 3 — Turn `finally` Cleanup (Success, Failure, Abort)**:
  - Verify `AgentOrchestrator.runAgentLoop` deletes `{runId}` temp dir on normal completion, thrown provider error, and `stopExecution` abort.
- **Test 4 — Project Switch & Project Delete Cleanup**:
  - Materialize temp attachments for Project A, invoke project-switch / project-delete cleanup for Project A -> assert Project A's `.metadata/.tmp-chat/` is completely gone and Project B never sees it.
- **Test 5 — App Shutdown & Startup Orphan Sweep**:
  - Materialize temp files across multiple projects + `os.tmpdir()/productos-chat-tmp/`, invoke `cleanupAllTempAttachments()` -> assert zero remaining files.
  - Seed synthetic stale `.metadata/.tmp-chat/stale-run/img.png` -> run startup sweep -> assert removed.

### 3.2 `node-backend/tests/multimodal-providers.test.mjs`
- **HostedAPIProvider**: Mock global `fetch`, assert `body.messages[n].content` contains `{ type: 'text' }` and `{ type: 'image_url', image_url: { url: 'data:image/png;base64,...' } }`.
- **OllamaProvider**: Mock `fetch`, assert `/api/chat` payload includes `images: ['<rawBase64>']` without `data:` prefix; assert vision-rejection 400 returns clear actionable message.
- **OpenAiCliProvider (`codex`)**: Mock/stub spawn args, assert `--image <tempFilePath>` arguments are passed and prompt includes temp image section.
- **ClaudeCodeProvider & GoogleCliProvider (`agy`/`gemini`)**: Assert temp image path references appear in CLI prompt and `--add-dir` is passed when temp files reside outside `projectPath` (for `agy` and `claude`, not unsupported legacy flags).
- **CustomCliProvider**: Assert `{{images}}` placeholder replacement and fallback `[Attached Temporary Images]` input injection; assert `supportsImages` does not break command parsing.
- **RoutedAIProvider (`model-router.mjs`)**: Assert `inferRequestTraits` ignores binary fields and `redactModelRequestForCloud` redacts secrets in text while preserving `attachments`.
- **Sanitization & Privacy**:
  - `sanitizeEventPayloadForLog` strips `attachments`, `images`, `dataUrl`, `audioBase64`.
  - `ChatService.saveChatToFile` saves `[1 attachment: slide.png]` and zero base64 strings.
  - `CostLog` `input_tokens` reflects prompt text length only (not base64 byte length).
  - `SilentLearner.captureEvent` receives sanitized text and does NOT trigger false-positive secret-redaction pause on PNG base64 data.

### 3.3 `node-backend/tests/transcription.test.mjs`
- **Capability Matrix (`getVoiceCapabilities`)**:
  - Neither OpenAI nor Gemini/AGY nor Whisper configured -> `availableProviders: []`, `resolvedFallback: null`.
  - Only OpenAI key/OAuth -> `openAi: true`.
  - Only Gemini key or `agy` CLI -> `gemini: true`.
  - Respects `settings.voiceInput.fallbackProvider` selection (`openAi` vs `gemini` vs `localWhisper` vs `none`).
- **OpenAI Whisper Transcription**: Mock `fetch`, verify `FormData` upload succeeds in memory, returns `{ text, provider: 'openAi' }`, writes zero files to disk.
- **Gemini / Whisper Fallback**: Mock Gemini REST response & local CLI temp cleanup, verify `{ text }` returned and temp audio deleted in `finally` even on failure.
- **Validation**: Reject missing audio, invalid MIME (`text/plain`), or `> 15 MB` payload (`400`); return `503` when no provider configured.

### 3.4 `node-backend/tests/research-log.test.mjs` (Extension)
- `logEvent(..., { attachments: [{ name: 'slide-1.png' }, { name: 'chart.png' }] })` writes `**Attachments**: 2 attachments (slide-1.png, chart.png)` in `research_log.md`.
- `parseResearchLog` extracts `attachmentSummary` and `attachments` array while still parsing legacy entries without `**Attachments**:` cleanly.

### 3.5 `tests/vision-capabilities.unit.test.mjs`
- Built-in vision models (`claude-3-5-sonnet`, `gpt-4o`, `gemini-3.6-flash-high`, `llava`, `llama3.2-vision`, `qwen2.5vl`) -> `'supported'`.
- Known text-only models (`llama3`, `mistral`, `deepseek-r1`, `gpt-oss-120b-medium`) -> `'unsupported'`.
- Custom CLI with `supportsImages` unset/false -> `'unverified'`.
- Custom CLI with `supportsImages: true` -> `'supported'` (clears warning).

---

## 4. Fixtures, Mocks & Coverage Targets

- **Fixtures**: Tiny valid 1x1 PNG (`iVBORw0KGgo...`), 1x1 JPEG, 1x1 WebP, 1x1 GIF byte constants inline in test helpers (no external binary fixture bloat).
- **Mocks**: Stubbed `fetch` (for Hosted API, Ollama, OpenAI Whisper, Gemini REST) and mock `spawn` / test CLI node script (matching existing pattern in `custom-provider.test.mjs`).
- **Coverage Targets**: >= 90% branch coverage on `temp-attachments.mjs`, `transcription.mjs`, `visionCapabilities.ts`, and orchestrator attachment sanitization paths.
- **Explicit Gaps**:
  - Real browser Web Speech recognition (`SpeechRecognition`) and `MediaRecorder` microphone capture cannot run natively in headless Node `node --test`; these are verified via DOM/API mocking in the Playwright E2E suite (`e2e-plan.md`).
  - Live external OpenAI/Gemini audio API calls are mocked in unit tests to remain offline-deterministic in CI.

---

## Standard Handoff Contract

- **Summary**: Defined deterministic `node --test` unit/integration test specifications covering magic-byte validation, 4-point temp cleanup, provider multimodal formats, base64 sanitization, hybrid STT fallback, Research Log parsing, and vision capability classification.
- **Decisions made**: Used inline minimal 1x1 valid image byte fixtures and mocked HTTP/CLI spawns to guarantee fast, offline, deterministic execution in Ubuntu CI.
- **Open risks**: React UI hooks (`useChatAttachments`, `useVoiceInput`) rely on browser Canvas/Clipboard/MediaRecorder APIs best verified in Playwright Chromium rather than pure Node tests.
- **Artifacts produced**: `docs/features/chat-multimodal-input/unit-test-plan.md`.
- **Handoff to next agent**: E2E Test Agent to specify browser-level Playwright journeys and selectors in `e2e-plan.md`.
- **Blockers**: None.
