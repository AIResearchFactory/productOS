# Model Routing

ProductOS supports a backend `autoRouter` provider that routes AI requests between a local trained provider and a cloud/fallback provider. The router is deliberately policy-driven: product features describe the task and privacy posture, while the router chooses the provider.

## Goals

- Keep private workspace/repository context on a local model by default.
- Allow cloud models for public or high-quality tasks when policy permits it.
- Add bounded local latency so the UI does not hang on slow local inference.
- Make fallback behavior explicit: no silent cloud exfiltration of sensitive data.
- Attach routing metadata to responses for debugging, telemetry, and cost reporting.

## Provider

Set `activeProvider` to `autoRouter` to enable routing.

```json
{
  "activeProvider": "autoRouter",
  "modelRouter": {
    "enabled": true,
    "mode": "auto",
    "localProvider": "ollama",
    "cloudProvider": "hostedApi",
    "fallback": "cloudRedacted",
    "localTimeoutMs": 3000,
    "backgroundTimeoutMs": 15000,
    "defaultPrivacyLevel": "workspace-private",
    "logDecisions": true
  }
}
```

## Routing modes

| Mode | Behavior |
| --- | --- |
| `auto` | Prefer local for workspace/private requests. For public requests, try local with cloud fallback. |
| `privacyFirst` | Prefer local even when privacy metadata is missing. Cloud fallback only follows the configured fallback mode. |
| `performanceFirst` | Use cloud first for public requests and local fallback. Private requests still go local first. |
| `localOnly` | Always use the configured local provider. No fallback. |
| `cloudOnly` | Always use the configured cloud provider. No fallback. |

## Fallback modes

| Fallback | Meaning |
| --- | --- |
| `none` | Do not fallback; return the local/cloud error. |
| `cloud` | Send the original request to cloud. Only use this for data that is allowed to leave the machine. |
| `cloudRedacted` | Redact obvious secrets/tokens/private-key blocks before cloud fallback. Default for private workspace routing. |
| `askUser` | Fail with an approval-required message instead of sending to cloud. |
| `local` | Used by cloud-first routes to fallback locally. |

## Request traits

The router currently resolves traits from request metadata and safe heuristics:

- `privacyLevel` / `privacy_level`
- `options.privacyLevel`
- `options.task`
- `options.priority`
- presence of a project path or workspace/repository context
- obvious secret/token/private-key patterns

Recommended future call shape:

```ts
await modelRouter.generate({
  task: 'code-review',
  privacyLevel: 'repo-private',
  priority: 'quality',
  messages,
});
```

## Latency policy

- `localTimeoutMs` bounds foreground local attempts. Default: `3000ms`.
- `backgroundTimeoutMs` bounds workflow/enrichment attempts. Default: `15000ms`.
- The router overhead is deterministic and should be negligible compared with model inference.
- If local inference times out and fallback is allowed, the response metadata records `fallbackUsed: true` and the fallback provider/model.

## Response metadata

Responses include `metadata.routing`:

```json
{
  "router": "autoRouter",
  "provider": "hostedApi",
  "model": "gpt-4.1-mini",
  "primaryProvider": "ollama",
  "fallbackProvider": "hostedApi",
  "fallbackUsed": true,
  "fallbackRequest": "cloudRedacted",
  "reason": "private-workspace-data",
  "latencyMs": 4102,
  "privacyLevel": "workspace-private",
  "containsSecrets": false,
  "local": false,
  "cloud": true
}
```

## Safety notes

`cloudRedacted` is a safety backstop, not a formal DLP guarantee. Highly sensitive flows should use `localOnly` or `askUser` until a stronger classifier/redactor exists.
