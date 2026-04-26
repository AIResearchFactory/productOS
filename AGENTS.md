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
npm run dev                # Run app in dev mode (starts both Vite and Axum server)
npm run dev:server         # Run Axum server only
```

**Testing:**
```bash
cd src-tauri && cargo test                    # Run all Rust tests
cd src-tauri && cargo test test_name          # Run specific test
npm run test:e2e                              # Run Playwright E2E tests
```

**Build:**
```bash
npm run build              # Build frontend (TypeScript + Vite) and backend (Rust server)
```

## Critical Architecture Patterns

**Project Structure (Non-Standard):**
- Projects stored in `{APP_DATA}/projects/` NOT in repo
- Each project MUST have `.metadata/project.json`
- **Artifact Ontology**: Roadmap → Initiative → User Story (see `src-tauri/src/models/artifact.rs`).
- Skills stored in `{APP_DATA}/skills/` with `.metadata/{skill-id}.json` sidecars

**Data Storage Locations (OS-Specific):**
- macOS: `~/Library/Application Support/ai-researcher/`
- Linux: `~/.local/share/ai-researcher/`
- Windows: `%APPDATA%\ai-researcher\`
- Override projects dir: Set `PROJECTS_DIR` env var (used in tests)

**Encryption Service (Critical):**
- Master key stored in OS keyring via `keyring` crate (see security architecture docs for keyring configuration details)
- Key cached in static Mutex (lazy init on first access)
- Test mode: Falls back to test key if keyring unavailable
- Secrets file: `secrets.encrypted.json` (AES-256-GCM encrypted)
- **Security Note:** Verify `secrets.encrypted.json` is in `.gitignore` and never committed to version control, even though encrypted

**AI Provider System:**
- Decoupled Architecture: Individual providers implement the `AIProvider` trait in `src-tauri/src/services/providers/`.
- Supported: `ClaudeCode`, `GeminiCli`, `OpenAiCli`, `Ollama`, `LiteLlm`, `HostedApi`.
- Extension: Add new providers in `src-tauri/src/services/providers/` and register in `AIService::create_provider`.
- Provider configs stored in global settings, loaded on switch.

**Axum API Backend:**
- Frontend (React/TypeScript) communicates via REST API to the Axum backend (`src-tauri/src/server/routes/`).
- API calls are handled by fetch wrappers in `src/api/server.ts`.
- Server-Sent Events (SSE) used for real-time trace logs and events (`project-added`, `project-removed`, `file-changed`).

**Path Utilities (Critical):**
- ALWAYS use `utils::paths` functions, never construct paths manually
- `initialize_directory_structure()` called on app startup (creates dirs + default skill template)
- Project validation: Check for `.metadata/project.json` existence



## Code Style

**TypeScript/React:**
- Path alias: `@/` maps to `./src/`
- Strict mode enabled (`strict: true` in tsconfig)
- Use `@/` imports for all internal modules
- Tailwind with custom HSL color variables

**Rust:**
- Use `anyhow::Result` for error handling in services
- Use `thiserror::Error` for custom error types in models
- Async runtime: `tokio` with `full` features
- Log with `log::info!`, `log::error!` macros
- Tests: Use `tempfile::TempDir` for isolated filesystem tests
- Tests: Set `PROJECTS_DIR` env var to override global paths

## Testing Gotchas

- Rust tests run from `src-tauri/` directory.
- **Verification Tests**: `src-tauri/tests/verification_test.rs` is the "Domain Truth" for integration testing across Workflows, Skills, Settings, and Projects.
- Integration tests in `src-tauri/tests/` (separate from unit tests).
- E2E tests in `/e2e/`
- Must set `HOME` and `PROJECTS_DIR` env vars in tests to avoid touching real user data.
- Encryption service has special test fallbacks for keyring failures.
- Use `#[cfg(test)]` blocks for test-specific code paths.
