# Backend Plan: Workspace Recovery & Recent Files Sorting

## API Changes

### `GET /api/projects/files`
- **Query Parameters**:
  - `project_id` (string, required): The ID of the project.
  - `sort` (string, optional): Sorting criteria. Supported values: `mtime` (last modified time descending).
- **Behavior**:
  - If `sort=mtime` is passed, retrieve the filesystem status (`fs.stat`) of all non-hidden files in the project directory.
  - Sort the files by `stat.mtimeMs` descending (newest first).
  - Return the sorted array of file names (`string[]`).
  - If no `sort` parameter is specified, fall back to the existing behavior: return the array of file names sorted alphabetically.

## Implementation Details

### `node-backend/lib/projects.mjs`
Modify `getProjectFiles` to take an options object:
```javascript
export async function getProjectFiles(projectId, options = {}) {
  const project = await getProjectById(projectId);
  const entries = await fs.readdir(project.path, { withFileTypes: true });
  const filtered = entries.filter((entry) => (entry.isFile() || entry.isSymbolicLink()) && !entry.name.startsWith('.'));
  
  if (options.sort === 'mtime') {
    const filesWithStats = await Promise.all(
      filtered.map(async (entry) => {
        const filePath = path.join(project.path, entry.name);
        try {
          const stat = await fs.stat(filePath);
          return { name: entry.name, mtime: stat.mtimeMs };
        } catch {
          return { name: entry.name, mtime: 0 };
        }
      })
    );
    return filesWithStats
      .sort((a, b) => b.mtime - a.mtime)
      .map(f => f.name);
  }

  return filtered
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}
```

### `node-backend/server.mjs`
Update the router handler for `/api/projects/files`:
```javascript
  if (req.method === 'GET' && url.pathname === '/api/projects/files') {
    const projectId = url.searchParams.get('project_id');
    const sort = url.searchParams.get('sort');
    if (!projectId) return sendError(res, 400, 'project_id is required');
    return sendJson(res, 200, await getProjectFiles(projectId, { sort }));
  }
```

## Backward Compatibility
- Since omitting `sort` yields the default alphabetical array, existing calls (such as in E2E tests, CLI operations) require no changes and behave exactly as before.
