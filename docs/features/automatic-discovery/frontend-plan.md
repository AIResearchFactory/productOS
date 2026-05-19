# Frontend Plan: Automatic Artifact and File Discovery

## 1) Event Integration
The frontend already has an SSE listener. We need to ensure it correctly invalidates the relevant queries.

### SSE Events to Handle:
- `file-changed`: Should invalidate `project-files` query for the specific project.
- `artifacts-changed`: Should invalidate `artifacts-list` query for the specific project.

## 2) Query Invalidation
In `src/api/server.ts` or wherever SSE is handled:
```typescript
case 'file-changed':
  queryClient.invalidateQueries(['projects', payload.projectId, 'files']);
  break;
case 'artifacts-changed':
  queryClient.invalidateQueries(['projects', payload.projectId, 'artifacts']);
  break;
```

## 3) User Experience
- The file tree should refresh smoothly.
- The artifact list should update in the background.

## 4) Verification
- Open the app, create a file in the terminal, and verify the UI updates.
- Create an `.md` file in `presentations/` and verify it appears in the Artifacts tab.
