# Frontend Plan: PWA Migration

## Summary
Inject PWA elements into the React Vite lifecycle.

## Component Plan
1. `index.html`: Ensure tags like `apple-mobile-web-app-capable` are set securely.
2. `public/offline.html`: Build an HTML/CSS standalone fallback referencing `Alex_and_Sarah_confused.jpg`.
3. `vite.config.ts`: Register and configure `vite-plugin-pwa` passing caching strategies (`standalone`, injecting manifest automatically based on `src-tauri/icons/`).

## API Contract Usage
Frontend expects Axum to host the entire app domain via `ServeDir` in local runtime deployments.

## Risks
Vite-plugin-pwa has some strict hashing requirements. We need to ensure dynamic assets like `/offline.html` are added to the Workbox precache whitelist.

## Next Steps
Deploy frontend dependencies (`npm i -D vite-plugin-pwa`).
