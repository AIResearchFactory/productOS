# UX Spec: Automatic Artifact and File Discovery

## 1) User Flows
### Flow A: Automatic Artifact Discovery
1. **Creation**: A markdown file is added to a designated artifact folder (e.g., `presentations/`) by an external tool (AI CLI, file explorer, etc.).
2. **Recognition**: The system automatically detects the file and registers it in the internal artifact manifest.
3. **Update**: The UI receives a real-time notification and updates the "Artifacts" view without user intervention.
4. **Visibility**: The new artifact appears in the list, ready to be viewed or edited.

### Flow B: Real-time File Explorer Sync
1. **Change**: Any file is added, modified, or deleted in the project directory.
2. **Detection**: The backend watcher identifies the change.
3. **Notification**: The UI is notified via SSE.
4. **Sync**: The File Explorer tree refreshes to reflect the current state of the filesystem.

## 2) Screen States
- **Discovery**: New items appear in the list with a subtle animation if possible (Standard React list behavior is sufficient).
- **Staleness**: The UI should never feel out of sync with the filesystem.

## 3) Interaction Notes
- **Low Latency**: The update should happen within ~500ms of the file operation.
- **Non-Intrusive**: No modals or banners should interrupt the user; the data just updates in place.

## 4) Handoff Notes
- **Frontend**: Verify that `useSSE` hook correctly handles `artifacts-changed` and `file-changed` events by invalidating React Query caches or triggering a re-fetch.
- **Backend**: Ensure the watcher is initialized for every project that the user opens or that is currently active.
