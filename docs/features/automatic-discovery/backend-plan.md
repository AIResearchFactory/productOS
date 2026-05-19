# Backend Plan: Automatic Artifact and File Discovery

## 1) Architecture Change
Introduce a `FileWatcherService` that manages `chokidar` instances for active projects.

### Components:
- **Watcher Manager**: Keeps track of which projects are being watched. Starts/stops watchers as projects are loaded/unloaded.
- **Artifact Sync Logic**: When a `.md` file is created in a recognized artifact folder, update the `artifacts.json` manifest.
- **SSE Bridge**: Connects watcher events to the `AgentOrchestrator` emit mechanism.

## 2) Data Model & Persistence
- The `artifacts.json` manifest will be the source of truth for the UI.
- The watcher will perform a "reconciliation" when it detects a new file that isn't in the manifest.

## 3) Implementation Details
### Watcher Setup
```javascript
const watcher = chokidar.watch(projectPath, {
  ignored: [
    '**/node_modules/**',
    '**/.git/**',
    '**/.metadata/**',
    '**/.DS_Store'
  ],
  persistent: true,
  ignoreInitial: true // We don't want to flood on startup, though a sync pass might be good
});
```

### Artifact Detection Logic
- Watch for `add` events.
- Check if file path matches any `TYPE_DIRS` from `artifacts.mjs`.
- If yes, read the file (extract title if possible) and add to `artifacts.json`.
- Emit `artifacts-changed`.

### File Explorer Logic
- Watch for `add`, `change`, `unlink` events.
- Emit `file-changed` with `projectId` and `fileName`.

## 4) Performance & Reliability
- **Debouncing**: Emit events with a small debounce (e.g., 200ms) to handle batch file operations.
- **Cleanup**: Ensure watchers are closed when the server shuts down or a project is deleted.

## 5) Risks
- **Large Projects**: Watching thousands of files might consume memory. ( Mitigation: strict ignore patterns).
- **Race Conditions**: AI creating a file vs. watcher detecting it. (Mitigation: use `ignoreInitial: true` and ensure the `AgentOrchestrator` still emits its own events to be safe).
