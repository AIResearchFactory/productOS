# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Canonical Workflow

**Mandatory Feature Pipeline:**
All feature development and major refactors MUST follow the [Agent Set: Feature Development Pipeline](file:///.agent/workflows/agent-set-feature-development.md).
- Follow the stage gates (Product -> UX -> FE/BE -> Test -> DevOps).
- Adhere to the **Handoff Contract** for every agent transition (Summary, Decisions, Risks, Artifacts, Next Steps, Blockers).
- **Commits & Pushing**: Every completed task (bug fix or feature) MUST have a detailed, conventional commit message and be pushed to the remote GitHub repository immediately.

## Build & Test Commands

**Development:**
```bash
npm run dev                # Run app in dev mode (starts both Vite and Node server)
npm run dev:server:node    # Run Node backend server only
```

**Testing:**
```bash
npm test                      # Run all backend tests
npm run test:e2e              # Run Playwright E2E tests
```

**Build:**
```bash
npm run build              # Build frontend (TypeScript + Vite) and prepare Node backend
```

## Critical Architecture Patterns

**Project Structure (Non-Standard):**
- Projects stored in `{APP_DATA}/projects/` NOT in repo
- Each project MUST have `.metadata/project.json`
- **Artifact Ontology**: Roadmap → Initiative → User Story
- Skills stored in `{APP_DATA}/skills/` with `.metadata/{skill-id}.json` sidecars

**Data Storage Locations (OS-Specific):**
- macOS: `~/Library/Application Support/ai-researcher/`
- Linux: `~/.local/share/ai-researcher/`
- Windows: `%APPDATA%\ai-researcher\`
- Override projects dir: Set `PROJECTS_DIR` env var (used in tests)

**Encryption Service (Critical):**
- Master key stored in OS keychain/keyring via native Node modules
- Secrets file: `secrets.encrypted.json` (AES-256-GCM encrypted)
- **Security Note:** Verify `secrets.encrypted.json` is in `.gitignore` and never committed to version control, even though encrypted

**AI Provider System:**
- Decoupled Architecture: Individual providers are managed in `node-backend/lib/providers/`.
- Supported: `ClaudeCode`, `GeminiCli`, `OpenAiCli`, `Ollama`, `LiteLlm`, `HostedApi`.
- Extension: Add new providers in `node-backend/lib/providers/`.
- Provider configs stored in global settings, loaded on switch.

**Node.js API Backend:**
- Frontend (React/TypeScript) communicates via REST API to the Node.js backend (`node-backend/server.mjs`).
- API calls are handled by fetch wrappers in `src/api/server.ts`.
- Server-Sent Events (SSE) used for real-time trace logs and events (`project-added`, `project-removed`, `file-changed`).

**Path Utilities (Critical):**
- ALWAYS use defined path utilities in `node-backend/lib/utils/paths.mjs`
- `initializeDirectoryStructure()` called on app startup
- Project validation: Check for `.metadata/project.json` existence

## Code Style

**TypeScript/React:**
- Path alias: `@/` maps to `./src/`
- Strict mode enabled (`strict: true` in tsconfig)
- Use `@/` imports for all internal modules
- Tailwind with custom HSL color variables

**Node.js (Backend):**
- Use ES Modules (`.mjs`)
- Async/Await for all I/O
- Log with standard console or a logging utility
- Tests: Use Node's native test runner (`node --test`)

## Testing Gotchas

- Backend tests run from the root or `node-backend/` directory.
- E2E tests in `/e2e/`
- Must set `HOME` and `PROJECTS_DIR` env vars in tests to avoid touching real user data.
- Encryption service has special test fallbacks for keychain failures.
