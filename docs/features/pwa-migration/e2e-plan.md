# E2E Test Plan: PWA Migration

## Focus
Ensure Playwright tests pass seamlessly now that the `dist/` is statically served alongside the backend natively via Axum, rather than relying on dual ports for test targets.

## Execution
Existing E2E scopes should execute. We may need to update the `playwright.config.ts` baseURL if the static single-command execution pattern transitions the frontend port from `5173` to `51423`.
