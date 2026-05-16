# QA Plan: Automatic Artifact and File Discovery

## 1) Risk-Based Test Matrix
| Risk | Severity | Mitigation |
|------|----------|------------|
| Performance lag on large projects | Medium | Strict ignore patterns for `node_modules`, `.git`, etc. |
| SSE connection drop | High | Frontend heartbeat + polling fallback already exists. |
| Race condition during AI file write | Low | `awaitWriteFinish` in watcher adds stability. |

## 2) Functional Test Scenarios
- **Manual File Creation**: Create a file in the terminal and verify it appears in the UI file explorer.
- **Artifact Discovery**: Create an `.md` file in `presentations/` and verify it appears in the Artifacts tab.
- **File Deletion**: Delete a file and verify it disappears from the UI.
- **Artifact Sync**: Verify `artifacts.json` is updated after adding/removing a markdown file in an artifact folder.

## 3) Regression Scope
- Standard artifact creation via UI should still work.
- Existing file operations (read/write/rename) should not be affected.

## 4) Negative Cases
- Creating a file in an ignored folder (e.g., `.git/`) should NOT trigger a UI update.
- Creating a non-markdown file in an artifact folder should NOT add it to the artifact manifest.
- Creating a markdown file in a non-artifact folder should NOT add it to the artifact manifest.
