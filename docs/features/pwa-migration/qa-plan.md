# QA Plan: PWA Migration

## Test Scenarios
1. **PWA Installation**: Verify that Chrome offers the "Add to Homescreen" prompt when navigating to the Axum single-port setup (`localhost:51423`).
2. **Offline Resilience**: Turn off backend, reload the page. Validate `offline.html` triggers cleanly showing the "Alex and Sarah" graphic.
3. **Application Static Serving**: Ensure a single `npm run ...` successfully serves the entire React bundle without breaking existing dynamic API routes.

## Negative/Pathological Cases
- Vite plugin fails to build manifest due to missing icon sizes.
- Axum `ServeDir` intercepts dynamic `api/` requests incorrectly.

## Regression Scope
The entirety of the app UI routing must be checked to ensure standard `Link` navigation in React is unimpeded.
