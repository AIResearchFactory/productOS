# productOS Telemetry

productOS can collect anonymous product-usage events so maintainers can understand which capabilities are used, what breaks, and what to improve next — without inspecting your work.

Telemetry is privacy-preserving and allowlisted at the source. If you do not want to send anything, see [Turning it off](#turning-it-off).

## What every event includes

- A random per-install UUID (`installId`) generated locally on first telemetry write and stored under the productOS app-data directory in `telemetry/telemetry.json`.
- A per-process UUID (`sessionId`).
- productOS version, runtime (`node`), Node.js version, OS, and CPU architecture.
- The event name, from the fixed allowlist below.
- A small structured payload, restricted to per-event allowlisted keys.

## What productOS never sends

productOS telemetry never sends file contents, file paths, project names, prompts, AI outputs, API keys, secrets, environment variables, stack traces, or arbitrary error messages.

Payload values are limited to strings, numbers, and booleans. String values are capped at 256 characters, and unknown payload keys are stripped before an event is queued.

## Event allowlist

| Event | Payload keys |
| --- | --- |
| `app.launched` | — |
| `app.exited` | `source` |
| `installation.status_checked` | `isFirstInstall` |
| `installation.started` | `source` |
| `installation.completed` | `success`, `durationMs` |
| `onboarding.step` | `step` |
| `onboarding.completed` | `provider`, `starterPack` |
| `settings.telemetry_changed` | `enabled` |
| `settings.saved` | `section` |
| `usage.viewed` | `scope` |
| `provider.detected` | `provider`, `success`, `durationMs` |
| `provider.selected` | `provider`, `source` |
| `agent.run.started` | `provider`, `source` |
| `agent.run.completed` | `provider`, `success`, `durationMs`, `tokensIn`, `tokensOut` |
| `agent.run.failed` | `provider`, `durationMs`, `errorCode` |
| `project.created` | `source` |
| `artifact.created` | `artifactType`, `source` |
| `artifact.saved` | `artifactType` |
| `artifact.imported` | `artifactType` |
| `artifact.exported` | `artifactType`, `exportFormat` |
| `skill.created` | `source` |
| `skill.updated` | `source` |
| `skill.imported` | `source` |
| `workflow.created` | `stepCount` |
| `workflow.started` | `stepCount`, `trigger` |
| `workflow.completed` | `status`, `durationMs`, `stepCount` |
| `doctor.run` | — |
| `error.unhandled` | `where`, `errorCode` |

The source allowlist lives in `node-backend/lib/telemetry/catalog.mjs`.

## Queueing and flushing

Events are written to a local NDJSON queue first (`telemetry/queue.ndjson`). Flushes send small batches with:

```text
POST $PRODUCTOS_TELEMETRY_ENDPOINT
```

If `PRODUCTOS_TELEMETRY_ENDPOINT` is not configured, productOS queues events locally but does not send network requests. Failed sends stay on disk and are retried later.

## Turning it off

Any one of these disables telemetry:

```bash
export PRODUCTOS_TELEMETRY_DISABLED=1
```

Set that in your shell profile to disable telemetry before productOS reads telemetry state, opens the queue, or performs telemetry network I/O.

You can also turn it off in the app:

```text
Settings → System → Privacy & Analytics → Anonymous Usage Analytics off
```

That preference is saved in `settings.json` as:

```json
{
  "telemetry": {
    "enabled": false
  }
}
```
