## Overview
This PR finalizes the migration from the Rust (Tauri) backend to the native Node.js implementation, resolves several regressions, and establishes the infrastructure for secure, automated releases.

## Remediated Regressions
- **AI Context Awareness**: Ported the Rust `ContextService` to Node. The AI now receives rich project context (README, logs, artifacts) in its system prompt.
- **Native OS Dialogs**: Implemented cross-platform native folder/file selection dialogs (macOS, Windows, Linux) to replace the `rfd` Rust crate.
- **Path Traversal Guard**: Added security guards in the output parser to prevent the AI from writing files outside the authorized workspace.

## UX & Stability Improvements
- **Startup Robustness**: The `productos` CLI now handles port conflicts gracefully by scanning for available ports and strictly waits for both backend and frontend to be reachable before opening the browser.
- **Onboarding Fix**: Implemented dynamic 'First Install' detection to correctly trigger the Onboarding Wizard for new users.
- **PWA Cleanup**: Disabled the Service Worker (which was causing persistent 'offline' state caching) and added an auto-unregister routine to clear legacy caches.

## Release Infrastructure (CI/CD)
- **Dependency Management**: Integrated **Renovate** to automate dependency updates and security patches.
- **Security Audit**: Added a mandatory **npm audit** step to the CI pipeline to block PRs with high-level vulnerabilities.
- **AI Code Reviewer**: Added an AI-powered code review workflow (Cursor-themed) to automatically analyze PR diffs for quality and standards.

## Verification
- Verified onboarding flow in a clean simulation environment.
- Confirmed context injection works across all CLI providers.
- Validated native dialogs on the host system.
- CI pipeline passed with 0 security vulnerabilities found.
