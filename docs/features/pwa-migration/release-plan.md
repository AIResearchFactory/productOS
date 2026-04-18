# DevOps Release Plan: PWA Migration

## CI/CD Updates
Update the standard workflows to leverage the single `npm run build && npm run serve` logic instead of keeping Vite running in parallel for deployment. Ensure the static binaries produced compile the `dist/` into standard deployable bundles.

## Env/Config Changes
Tauri variables and metadata configurations are retained but largely superficial until further deprecation runs happen independently. 
The Axum binary requires reading `dist/` securely in deployed locations. Ensure Cargo uses relative `dist/` logic safely or embeds via `include_dir` if needed in the future (though `ServeDir` suffices).
