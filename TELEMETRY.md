# ProductOS Telemetry

ProductOS can collect anonymous product-usage events so maintainers can understand which capabilities are used, what breaks, and what to improve next — without inspecting your work.

Telemetry is privacy-preserving and allowlisted at the source. If you do not want to send anything, see [Turning it off](#turning-it-off).

## What every event includes

- A random per-install UUID (`installId`) generated locally on first telemetry write and stored under the ProductOS app-data directory in `telemetry/telemetry.json`.
- ProductOS version, runtime (`node`), Node.js version, OS, and CPU architecture.
- The event name, from the fixed allowlist below.
- A small structured payload, restricted to per-event allowlisted keys.

## What ProductOS never sends

ProductOS telemetry never sends file contents, file paths, project names, prompts, AI outputs, API keys, secrets, environment variables, stack traces, or arbitrary error messages.

Payload values are limited to strings, numbers, and booleans. String values are capped at 256 characters, and unknown payload keys are stripped.

## Google Analytics Integration & Offline Queuing

To secure, aggregate, and streamline telemetry processing, ProductOS uses **Google Analytics 4 (GA4)** on the client side.

When usage analytics are enabled, client-side event triggers route anonymously and securely to Google Analytics. Anonymized Tech metadata (e.g. browser/OS details, country-level geolocation) is automatically collected as part of Google Analytics standard telemetry protocol. All data is processed in accordance with the [Google Analytics Privacy & Terms](https://policies.google.com/privacy).

### Client-Side Offline Queuing

If you are offline or if there is a network error when sending events to Google Analytics, ProductOS automatically queues events locally in the browser's `localStorage` (capped at 100 events). These queued events are securely and automatically flushed to Google Analytics once you are back online or when the application restarts.

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
| `project.deleted` | `source` |
| `artifact.created` | `artifactType`, `source` |
| `artifact.saved` | `artifactType` |
| `artifact.imported` | `artifactType` |
| `artifact.exported` | `artifactType`, `exportFormat` |
| `file.imported` | `fileType` |
| `file.exported` | `exportFormat` |
| `secrets.exported` | — |
| `skill.created` | `source` |
| `skill.updated` | `source` |
| `skill.imported` | `source` |
| `custom_cli.added` | `provider` |
| `integrations.enabled` | `channel` |
| `workflow.created` | `stepCount` |
| `workflow.started` | `stepCount`, `trigger` |
| `workflow.completed` | `status`, `durationMs`, `stepCount` |
| `error.unhandled` | `where`, `errorCode` |

The source allowlist lives in `node-backend/lib/telemetry/catalog.mjs`.



## Turning it off

You can turn it off in the app:

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
