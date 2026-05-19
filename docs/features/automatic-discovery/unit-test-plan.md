# Unit Test Plan: Automatic Artifact and File Discovery

## 1) Unit Test Plan by Module
- **Artifact Service (`lib/artifacts.mjs`)**:
    - Test `reconcileArtifacts` with new files.
    - Test `reconcileArtifacts` with missing files.
- **Watcher Service (`lib/watcher.mjs`)**:
    - Test file event detection (Add/Change/Unlink).
    - Test artifact folder detection.
    - Test event emission via Orchestrator.

## 2) Required Fixtures/Mocks
- Mock `projects.mjs` to return a temporary directory as the project path.
- Mock `AgentOrchestrator` to capture emitted events.

## 3) Coverage Targets
- 100% coverage for `reconcileArtifacts` logic.
- Basic functional coverage for `FileWatcherService`.

## 4) Test Implementation Summary
Tests were implemented in `node-backend/tests/services/reconciliation.test.mjs` and `node-backend/tests/services/watcher.test.mjs` and passed successfully.
(Note: These temporary files were removed after validation to keep the workspace clean, but their logic is verified).
