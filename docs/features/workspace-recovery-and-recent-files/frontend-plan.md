# Frontend Plan: Workspace Recovery & Recent Files Sorting

## Component & State Plan

### Client API Modifications
- Update `filesApi.getProjectFiles` in `src/api/server.ts` to accept an optional `sort?: string` parameter:
  ```typescript
  getProjectFiles: (projectId: string, sort?: string) => serverFetch<string[]>(`/api/projects/files?project_id=${projectId}${sort ? `&sort=${sort}` : ''}`),
  ```
- Update `runtimeApi.getProjectFiles` in `src/api/runtime.ts` to accept `sort?: string` and pass it to `filesApi.getProjectFiles`.

### Project Loading & State Refresh
In `src/pages/Workspace.tsx` and `src/hooks/useFileWatcherEvents.ts`, fetch the project files using `appApi.getProjectFiles(projectId, 'mtime')`.
This stores the project's documents array in modification-time-descending order (newest first).

### Sidebar Sorting
Since `activeProject.documents` will now be sorted by modification time, update the sidebar rendering in `src/components/workspace/Sidebar.tsx` to sort documents alphabetically for the file explorer display:
```typescript
const sortedDocs = activeProject.documents 
  ? [...activeProject.documents].sort((a, b) => a.name.localeCompare(b.name))
  : [];
```

### Tab State Recovery (localStorage)
In `src/pages/Workspace.tsx`:
- Scoped keys:
  - `productOS_open_documents_${projectId}`
  - `productOS_active_document_${projectId}`
- **Persistence**: Add a `useEffect` that runs when `openDocuments`, `activeDocument` (or its ID), or `activeProject?.id` changes. It stores the list of open document IDs and the active document ID in `localStorage`.
- **Restoration**: On project load/switch, retrieve these saved values from `localStorage`. Reconstruct the `openDocuments` array by matching the saved IDs against the files list fetched from the backend. If no tabs are saved, fall back to opening the project's Product Home dashboard.
