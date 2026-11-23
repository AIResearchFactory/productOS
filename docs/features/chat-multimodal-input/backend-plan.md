# Backend Implementation Plan: Chat Multimodal Input (v0.5.1)

> **Feature**: `chat-multimodal-input`  
> **Target Version**: `v0.5.1`  
> **Status**: Draft — Ready for Review  
> **Pipeline Stage**: Backend Agent -> QA & Unit Test Agents  
> **Reference Specs**: [prd.md](./prd.md) &bull; [frontend-plan.md](./frontend-plan.md)  

---

## 1. Executive Summary

This plan specifies the Node.js backend (`node-backend/`) architecture for ephemeral image references, multimodal dispatch across all AI providers, deterministic zero-leakage temp-file cleanup (on turn end, project switch, app quit, and startup), lightweight text-only logging, and hybrid speech-to-text fallback transcription.

---

## 2. File Inventory

```
node-backend/
├── server.mjs                              [MODIFY] Raise /api/chat/send maxBytes (25MB); add voice & vision routes; hook cleanup on project switch, delete, shutdown, and startup
└── lib/
    ├── temp-attachments.mjs                [NEW] Validation, magic-byte check, ephemeral disk lifecycle & multi-trigger cleanup
    ├── transcription.mjs                   [NEW] Voice capability inspection & in-memory/ephemeral fallback STT (OpenAI / Gemini / Whisper)
    ├── orchestrator.mjs                    [MODIFY] Materialize/cleanup CLI temp images, sanitize logs/cost/SilentLearner, pass attachment metadata
    ├── chat.mjs                            [MODIFY] Ensure markdown history & companion JSON store zero base64 (lightweight markers only)
    ├── research-log.mjs                    [MODIFY] Record & parse **Attachments**: summary line cleanly
    ├── model-router.mjs                    [MODIFY] Preserve attachments safely in inferRequestTraits & redactModelRequestForCloud
    ├── watcher.mjs                         [VERIFY] Confirm **/.metadata/** ignore covers .metadata/.tmp-chat/
    └── providers/
        ├── base.mjs                        [MODIFY] Add usesTempFilesForImages() & CLI attachment block formatting
        ├── hosted.mjs                      [MODIFY] OpenAI-compatible multimodal image_url content blocks
        ├── ollama.mjs                      [MODIFY] Ollama /api/chat message.images base64 + non-vision error handling
        ├── google.mjs                      [MODIFY] Pass --add-dir (if outside cwd) + temp image path instructions
        ├── claude.mjs                      [MODIFY] Pass --add-dir (if outside cwd) + temp image path instructions for Read tool
        ├── openai.mjs                      [MODIFY] Pass --image <path> flags to codex exec + prompt path reference
        └── custom.mjs                      [MODIFY] Inject temp paths into prompt & optional {{images}} arg placeholder
```

---

## 3. Ephemeral Temp-File Lifecycle & Privacy Architecture (`temp-attachments.mjs`)

### 3.1 Storage Location & Isolation
- **API Providers (`HostedAPIProvider`, `OllamaProvider`)**: Zero disk writes. Images pass strictly in memory as data URLs or raw base64.
- **CLI Providers (`GoogleCliProvider`, `ClaudeCodeProvider`, `OpenAiCliProvider`, `CustomCliProvider`)**:
  - When an active project exists: `{project.path}/.metadata/.tmp-chat/{runId}/`
    - Why `.metadata/.tmp-chat/`: `watcher.mjs` already ignores `**/.metadata/**`, `getProjectFiles()` excludes hidden directories, Silent Learner ignores `.metadata`, AND the files reside inside the CLI's `cwd` (`project.path`) so sandboxed CLIs can inspect them without extra broad filesystem permissions.
  - When no project is active: `{os.tmpdir()}/productos-chat-tmp/{runId}/`.
  - In-memory registry `activeTempDirs = Map<string, Set<string>>` (keyed by `projectId || '__global__'`) tracks every created run directory.

### 3.2 Deterministic 4-Point Cleanup Contract
| Trigger | Hook Location | Behavior |
| :--- | :--- | :--- |
| **1. Turn End / Error / Abort** | `AgentOrchestrator.runAgentLoop` `finally` block | Unconditionally runs `fs.rm(tempDir, { recursive: true, force: true })` and removes from registry. |
| **2. Project Switch / Delete** | `server.mjs` (`POST /api/projects/active`, `POST /api/settings/global` when `lastProjectId` changes, `DELETE /api/projects/delete`) | Tracks `currentActiveProjectId`; before switching to a new project, stops any running execution for the prior project and deletes its `.metadata/.tmp-chat/` directory + any registered temp dirs so zero data leaks between projects. |
| **3. Application Quit** | `server.mjs` (`POST /api/system/shutdown` & `gracefulShutdown` on `SIGINT`/`SIGTERM`) | Awaits `cleanupAllTempAttachments()` (sweeping both `activeTempDirs`, `os.tmpdir()/productos-chat-tmp`, and all known projects' `.metadata/.tmp-chat/`) before `process.exit`. |
| **4. Startup Orphan Sweep** | `server.mjs` startup boot sequence | Sweeps stale `os.tmpdir()/productos-chat-tmp/` and every project's `.metadata/.tmp-chat/` from prior unclean crashes (`SIGKILL` / power loss). |

---

## 4. API Specification (`server.mjs`)

### 4.1 `POST /api/chat/send` (and `/api/chat`)
- Increase `readJson(req, { maxBytes: 25 * 1024 * 1024 })` (matching the existing `35 MB` pattern used for `/api/projects/presentation/template` on line 899).
- **Attachment Validation Rules**:
  - `attachments` allowed only as an array (`<= 4` items) on messages (primarily the latest user message).
  - Supported `mimeType`: `image/png`, `image/jpeg`, `image/webp`, `image/gif`.
  - Decode base64 portion of `dataUrl`; verify decoded byte length `<= 10 * 1024 * 1024`.
  - **Magic-byte signature check**:
    - PNG: `89 50 4E 47 0D 0A 1A 0A`
    - JPEG: `FF D8 FF`
    - GIF: `47 49 46 38` (`GIF8`)
    - WebP: `RIFF....WEBP`
  - Reject mismatched/spoofed payloads with HTTP `400`.
  - Sanitize filenames (strip directory separators, null bytes, control chars; cap length; fallback to `image-1.png`).

### 4.2 `GET /api/chat/voice/capabilities`
- **Response (`200 OK`)**:
  ```json
  {
    "fallbackProviders": {
      "openAi": true,
      "gemini": true,
      "localWhisper": false
    },
    "availableProviders": ["openAi", "gemini"],
    "configuredFallback": "auto",
    "resolvedFallback": "openAi"
  }
  ```
- Inspects `secrets` (`OPENAI_API_KEY`, `openai_api_key`, `OPENAI_OAUTH_ACCESS_TOKEN`, `GEMINI_API_KEY`, `gemini_api_key`, `GOOGLE_API_KEY`), CLI presence (`resolveCliCommand('agy', 'gemini')`, `checkCli('whisper')`), and `settings.voiceInput?.fallbackProvider`.

### 4.3 `POST /api/chat/transcribe`
- **Request** (`maxBytes: 20 * 1024 * 1024`):
  ```json
  {
    "audioBase64": "<base64>",
    "mimeType": "audio/webm",
    "language": "en-US",
    "preferredProvider": "auto"
  }
  ```
- **Validation**: Requires non-empty `audioBase64` (`<= 15 MB` decoded) and allowed audio MIME (`audio/webm`, `audio/mp4`, `audio/mpeg`, `audio/wav`, `audio/ogg` with optional `;codecs=...`).
- **Execution (`lib/transcription.mjs`)**:
  - `openAi`: `POST https://api.openai.com/v1/audio/transcriptions` using Node's native `FormData` + `Blob` (zero disk write, zero external packages); uses `gpt-4o-mini-transcribe` (falling back to `whisper-1`).
  - `gemini`: If API key present, calls Gemini `generateContent` REST endpoint (`gemini-2.5-flash`) with `inlineData` audio part and prompt *"Transcribe this spoken message accurately. Output only the verbatim transcript text."* (zero disk write). If only CLI (`agy`/`gemini`) is configured without a key, writes ephemeral temp audio file in `os.tmpdir()`, removes unconditionally in `finally`.
  - `localWhisper`: Runs `whisper` CLI with ephemeral temp audio file in `os.tmpdir()`, removes unconditionally in `finally`.
- **Errors**:
  - `400`: Invalid audio MIME, missing audio, or size exceeded.
  - `503`: No configured transcription provider available (`errorCode: 'NO_STT_PROVIDER'`).
  - `502`: Upstream transcription provider failed.
- **Response (`200 OK`)**: `{ "text": "...", "provider": "openAi" }`. Never writes audio or transcript directly to disk.

### 4.4 `GET /api/chat/vision/check?provider=<id>&model=<name>`
- For `ollama`: queries local Ollama `POST /api/show` (`{ name: model }`) with a 2s timeout to inspect `capabilities` (e.g., `capabilities.includes('vision')`) or `details.families` (e.g., `clip`, `mllama`), returning `{ status: 'supported' | 'unsupported' | 'unverified', reason }`.
- For `custom-*`: checks `settings.customClis` for `supportsImages === true` (`'supported'`) vs unset/false (`'unverified'`).
- For built-in providers: returns deterministic capability classification (`'supported'` or `'unsupported'`).

---

## 5. Orchestrator, Provider & Logging Behavior

### 5.1 Sanitization Pipeline in `orchestrator.mjs`
1. Add `'attachments'`, `'images'`, `'dataUrl'`, `'audioBase64'` to `SENSITIVE_LOG_KEYS` so `sanitizeEventPayloadForLog()` never prints raw binary payloads.
2. Separate messages into:
   - **`providerMessages`**: contains `attachments` (for API providers) or `tempImagePaths` (for CLI providers).
   - **`sanitizedMessages`**: binary payloads stripped; when attachments were present on a user message, prepends a lightweight prefix:
     ```markdown
     [2 attachments: slide-1.png, chart.png]
     ```
     followed by the user's text.
3. Pass **only `sanitizedMessages`** to:
   - `ChatService.saveChatToFile(projectId, allSanitizedMessages, activeProvider)`
   - `CostLog` token estimation (`estimatedTokensIn`) — prevents base64 length from falsely inflating token counts and costs!
   - `SilentLearner.captureEvent(...)` — prevents base64 character entropy from triggering false-positive secret redaction pauses in `privacy-filter.mjs`!
4. Pass attachment metadata `attachmentsMeta = [{ name, mimeType }]` to `logEvent(projectId, activeProvider, null, response.content, chatFileName, { attachments: attachmentsMeta })`.

### 5.2 Research Log Format (`research-log.mjs`)
- When `options.attachments?.length > 0`, `logEvent` emits right below `**Chat File**`:
  ```markdown
  **Attachments**: 2 attachments (slide-1.png, chart.png)
  ```
- `parseResearchLog` parses `**Attachments**:` into `entry.attachmentSummary` and `entry.attachments` (parsed filename list) while keeping full backward compatibility with logs that lack that header.

### 5.3 Provider Image Formats
- `HostedAPIProvider`: Converts messages with `attachments` into OpenAI-compatible multi-part content arrays (`[{ type: 'text', text }, { type: 'image_url', image_url: { url: att.dataUrl } }]`).
- `OllamaProvider`: Strips `data:...;base64,` prefix and attaches `images: [base64]` on the user message object; converts 400/unsupported errors mentioning images/vision into a clear user-facing message.
- `OpenAiCliProvider`: For `codex exec`, appends `--image <tempPath>` for each temp image and appends `[Attached Temporary Images]` reference list to `buildCliInput`.
- `ClaudeCodeProvider` & `GoogleCliProvider`: If any temp image resides outside `projectPath` (e.g., no project active -> `os.tmpdir()`), passes `--add-dir <tempDir>` (note: check `gemini` vs `agy` CLI flags so unsupported flags aren't blindly passed to legacy `gemini`); instructs the CLI via `buildCliInput` to inspect the temporary image file path(s).
- `CustomCliProvider`: Replaces optional `{{images}}` placeholder in `args` with temp path(s) and includes the `[Attached Temporary Images]` block in `buildCliInput`.
- `RoutedAIProvider` (`model-router.mjs`): `inferRequestTraits` extracts only text content (`typeof m.content === 'string'`) without reading base64, and `redactModelRequestForCloud` preserves `attachments` / `tempImagePaths` intact during redaction.

---

## 6. Performance, Backward Compatibility & Observability

- **Memory**: Stream-free JSON reads are capped at `25 MB` (chat) and `20 MB` (transcribe); client downscaling to `<= 2048px` keeps typical payloads under `1–3 MB`.
- **Backward Compatibility**: All existing routes (`POST /api/chat/send` with plain `{ role, content }`, `research_log.md` entries without `**Attachments**:`, `settings.json` without `voiceInput` or `supportsImages`) remain 100% compatible.
- **Observability**: Track non-PII allowlisted telemetry events (`chat.image_attached`, `chat.voice_dictated`) with no filenames, base64, or transcript text; trace logs emit only counts (`"Prepared 2 temporary image attachments"`).

---

## Standard Handoff Contract

- **Summary**: Defined backend architecture for `v0.5.1` including `temp-attachments.mjs` with 4-point cleanup (turn end, project switch/delete, app shutdown, startup sweep), `transcription.mjs` in-memory/ephemeral STT fallback, multimodal provider adapters across all 7 provider families, and sanitized text-only logging across `ChatService`, `ResearchLog`, `CostLog`, and `SilentLearner`.
- **Decisions made**: Stored CLI temp images in `.metadata/.tmp-chat/{runId}/` when a project is active so `watcher.mjs` and `SilentLearner` ignore them automatically while staying inside CLI `cwd`; used native `FormData`/`Blob` for OpenAI transcription with zero new npm dependencies.
- **Open risks**: `GoogleCliProvider` legacy `gemini` binary vs `agy` binary flag parity (`--add-dir` may be `agy`-specific—must gate `--add-dir` on `isAgy` or `claude` while keeping prompt path instructions for all CLIs); Ollama `/api/show` availability on older Ollama versions (gracefully fallback to model-name heuristic).
- **Artifacts produced**: `docs/features/chat-multimodal-input/backend-plan.md`.
- **Handoff to next agent**: QA Strategy Agent to author `qa-plan.md` covering P0/P1/P2 risk matrix, regression suite, and negative/leakage tests.
- **Blockers**: None.
