# Node.js Backend (`node-backend/`)

`node-backend/` is the primary production backend for **productOS**, powering the REST API, SSE event stream, AI provider orchestration, file & artifact management, Silent Learner, workflows, and OS-native secret encryption.

## Architecture

- **`server.mjs`**: HTTP & SSE API server (default port `51423`, configurable via `PRODUCTOS_NODE_SERVER_PORT`, bound to `127.0.0.1` by default).
- **`lib/paths.mjs`**: Canonical app data, projects, skills, and path-containment (`safeJoin`, `assertSafeId`) utilities.
- **`lib/encryption.mjs`**: AES-256-GCM secret storage backed by OS keychain/credential stores.
- **`lib/providers/`**: AI provider adapters (`claude`, `google`, `openai`, `ollama`, `hosted`, `custom`).
- **`lib/orchestrator.mjs` & `lib/workflows.mjs`**: Agent loop execution and multi-step workflow engine.
- **`lib/silent-learner/`**: Local SQLite knowledge store, privacy filter, enrichment queue, and retrieval.
- **`lib/watcher.mjs`**: Chokidar workspace file watcher emitting real-time SSE updates.

## Running Locally

```bash
# Run both Vite frontend and Node.js backend
npm run dev

# Run Node.js backend server only (watch mode)
npm run dev:server:node

# Run production build + Node.js server
npm start
```

## Testing

```bash
# Run all backend & unit tests
npm test

# Run backend tests (CI suite)
npm run test:backend
```

## Environment Variables

- `PRODUCTOS_NODE_SERVER_PORT` — Backend listen port (default `51423`)
- `PRODUCTOS_BIND_HOST` — Bind host (default `127.0.0.1`)
- `APP_DATA_DIR` / `PROJECTS_DIR` / `SKILLS_DIR` — Override storage paths (used in tests)
- `ALLOW_UNENCRYPTED_SECRETS_FOR_TESTS=true` — Explicit plain-text secret fallback for non-keychain test environments
