# Product Requirements Document: PWA Migration

## Summary
The goal is to migrate productOS to a Progressive Web App (PWA) to enable an offline-first native desktop experience while shedding the overhead of the Tauri wrapper.

## Problem Statement
The user currently interacts with productOS via browser tabs, not feeling like a native application, or having to deal with Tauri distribution. 

## User Stories
1. As a researcher, I want to keep my interaction with productOS entirely local and secure.
2. As a desktop user, I want to install the app to my homescreen/dock via my browser (Chrome/Edge).
3. As a developer, I want a single unified `npm` command that starts both the Axum backend and serves the frontend in production modes.

## Scope
- IN: Setup PWA via Vite.
- IN: Fallback offline pages with Alex & Sarah persona.
- IN: Axum server acting as a static file server for the built frontend.
- OUT: Deleting the existing Tauri codebase. 

## Acceptance Criteria
- [ ] Users can install the PWA from localhost to their OS.
- [ ] A single bash command executes both the Axum server and UI.
- [ ] Offline status shows the custom `offline.html` page reliably.

## Decisions Made
- Use `vite-plugin-pwa` for manifest caching.
- Migrate Axum to serve React static files using `tower_http::services::ServeDir`.
- Retain existing icons from `src-tauri/icons`.

## Handoff to UX
UX to provide offline missing-content screens.
