# Node backend prototype

This folder is the first concrete step toward a pure npm backend.

Current scope:
- `GET /api/health`
- `GET /api/system/data-directory`
- `GET /api/settings/paths`
- `GET/POST /api/settings/global`
- `GET /api/projects`
- `GET /api/projects/get`
- `GET /api/projects/files`
- `GET /api/research-log`
- `POST /api/research-log/clear`

Current non-goals:
- no chat/runtime orchestration
- no workflows
- no secrets/keyring
- no MCP
- no artifact/file mutation APIs
- no skills implementation yet (routes return 501)

Why this slice first:
- low-risk
- mostly file-backed CRUD
- lets us prove path resolution and data-shape compatibility before replacing the harder Rust runtime subsystems

Run locally:

```bash
node node-backend/server.mjs
```

Default port:
- `51424`

Override:
- `PRODUCTOS_NODE_SERVER_PORT=...`

This is intentionally not wired into the main app yet. It is a migration workbench, not the default runtime.
