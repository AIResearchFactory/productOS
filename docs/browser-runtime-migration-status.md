# Browser Runtime Migration Status

Status: functionally complete

## What was completed

The app's browser-first shared surface now routes through shared runtime APIs instead of assuming a native Tauri environment.

Completed areas include:

- runtime selection through `appApi`
- project CRUD
- global settings safe slice
- file CRUD
- markdown reads and writes for shared paths
- artifact CRUD
- search and replace in files
- workflow CRUD
- workflow schedule save and clear
- workflow history storage
- chat-side workflow save, schedule, and file-read flows
- AI completion and workflow generation hooks
- browser chat event fallback behavior
- provider switching and chat runtime controls
- chat send path through shared API
- browser-safe usage stats fallback
- browser-safe stop execution fallback
- browser-safe skill persistence
- import/export and artifact-import flows routed through shared API with honest browser gating
- update check, version, and config paths routed through shared API
- MCP marketplace and related browser-safe management flows routed through shared API
- final `Workspace.tsx` browser-safe cleanup for shared runtime paths

## Intentional native-only areas

These remain native-only by design or by acceptable current scope:

- real workflow execution lifecycle and native progress events
- artifact migration operations
- some native event listener paths in workspace/settings surfaces
- native install and filesystem picker flows that require Tauri capabilities

In browser mode, these paths should fail clearly or stay gated rather than pretending to work.

## Build status

- `npm run build` passes

## Remaining technical debt

The remaining warnings are build and bundling concerns, not migration blockers:

- ineffective dynamic import warnings involving Tauri event, updater, and dialog internals
- large chunk warning on the main bundle
- plugin timing warnings during Vite build

These should be treated as a separate bundling and performance pass, not as incomplete browser-runtime migration.
