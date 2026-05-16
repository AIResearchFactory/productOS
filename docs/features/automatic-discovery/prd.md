# PRD: Automatic Artifact and File Discovery

## 1) Problem Statement
When new files (including artifacts) are created in the project directory by external processes (like AI CLIs or manual file operations), the UI does not automatically update to show them. Specifically for artifacts, the `artifacts.json` manifest becomes stale, and even a manual UI refresh may not pick up new files if they aren't registered in the manifest.

## 2) User Stories
- **Real-time File Updates**: As a user, I want the file list to update in real-time when the AI creates new files in my project.
- **Automatic Artifact Discovery**: As a user, I want new markdown files created in artifact folders (e.g., `presentations/`) to be automatically recognized as artifacts and appear in the Artifacts tab.
- **Zero Configuration**: As a user, I want the system to handle the "registration" of new artifacts automatically so I don't have to manually edit JSON files.

## 3) Scope (in/out)
### In-scope
- Backend file watching for project directories.
- Automatic discovery and registration of new artifact files (`.md` files in recognized artifact folders).
- SSE notification to the UI for file system changes.
- Refreshing the artifact manifest when changes are detected.

### Out-of-scope
- Automatic deletion of artifacts from manifest when files are deleted (though it should probably be handled for consistency).
- Watching files outside the project directory.

## 4) Acceptance Criteria
- Creating a new `.md` file in the `presentations/` folder of a project (manually or via CLI) should trigger a UI update and make the new artifact appear in the Artifacts list.
- Creating any file in the project directory should update the file explorer in the UI.
- The `artifacts.json` file should be updated automatically when a new `.md` file is added to an artifact folder.

## 5) Edge Cases
- **Debouncing**: Rapidly creating multiple files should not flood the UI with updates.
- **Deletions**: Deleting a file should remove it from the manifest and UI.
- **Exclusions**: Ignore `node_modules`, `.git`, `.metadata`, etc., to save resources.

## 6) Dependencies
- `chokidar` for robust cross-platform file watching.
- Existing SSE implementation in `server.mjs`.

## 7) Prioritized Implementation Slices
1. **MVP**: Basic watcher emitting events + artifact manifest sync on new files.
2. **V2**: Full sync (deletions/renames) + performance tuning.

## 8) API/Contract Assumptions
- SSE events `file-changed` and `artifacts-changed` are handled by the frontend.
- `listArtifacts` and `getProjectFiles` APIs are used to refresh state.
