# Silent Learner UX Notifications MVP

This MVP slice defines how ProductOS should notify the user when Silent Learner has finished preparing useful local memory/model context and is ready to help in the background.

The first implementation should be lightweight: in-app notifications only, no external Telegram/WhatsApp/email notifications, and no cloud backup requirement.

## User Promise

When Silent Learner finishes its first useful local distillation pass, the user should understand:

- Silent Learner is ready.
- It learned locally from approved/safe work.
- It can now use those lessons in future ProductOS AI tasks.
- The user can review or delete what was learned.

## MVP Trigger

Fire a UX notification when a Silent Learner job transitions into `memory_ready` for the first time in a workspace.

Recommended event contract:

```ts
type SilentLearnerReadyEvent = {
  type: 'silent_learner.memory_ready';
  workspaceId: string;
  memoryItemCount: number;
  sourceSessionCount: number;
};
```

This event can be emitted after ProductOS has:

1. Captured at least one eligible completed AI-assisted session.
2. Redacted sensitive content.
3. Produced one or more distilled memory items.
4. Indexed those items for retrieval.
5. Marked them safe for local use.

## Notification Pattern

Use ProductOS' existing toast system for the first MVP.

### Primary toast

Title:

```text
Silent Learner is ready
```

Description:

```text
ProductOS learned {memoryItemCount} local lesson(s) from your recent work. Future AI tasks can now reuse them privately.
```

Actions:

- `Review lessons`
- `Dismiss`

If the existing toast action surface only supports one action, use `Review lessons` as the action and keep dismiss via the standard close button.

### Compact copy variant

For smaller surfaces:

```text
Silent Learner ready · {memoryItemCount} local lessons available
```

### Empty or low-signal case

Do not notify if no useful lesson was created.

Instead, keep the status as:

```text
Silent Learner: Observing
```

## Secondary Status Surface

In the future Silent Learner panel or settings card, show a persistent status row:

```text
Silent Learner: Memory Ready
{memoryItemCount} lessons indexed locally · Last updated {relativeTime}
```

Suggested actions:

- Review lessons
- Pause learning
- Forget this workspace

## State Machine

```text
Off
  ↓ enable
Observing
  ↓ eligible session captured
Distilling
  ↓ redaction + memory index complete
Memory Ready
  ↓ optional backup configured
Backup Synced
  ↓ optional adapter training enabled
Adapter Ready
```

Only `Memory Ready`, `Backup Synced`, and `Adapter Ready` should generate positive user notifications.

Avoid noisy notifications for routine observing or background summarization.

## Notification Rules

- Notify only once per workspace for the first `memory_ready` event.
- After the first notification, use quieter status updates unless the user explicitly enables more alerts.
- Never show a celebratory notification if redaction failed.
- Never expose raw prompt/response text in the toast.
- If the event comes from local-only mode, say “local” or “privately” in the copy.
- If cloud backup is disabled, do not mention backup.

## Error and Safety Notifications

### Redaction failed

Title:

```text
Silent Learner paused
```

Description:

```text
ProductOS found sensitive content and did not save new lessons. Review privacy settings to continue.
```

Action:

```text
Review privacy
```

### Ollama/local model unavailable

Title:

```text
Local model unavailable
```

Description:

```text
Silent Learner saved local lessons, but Ollama is not ready yet.
```

Action:

```text
Open model settings
```

### No useful learning signal

No toast. Keep silent.

## Accessibility Requirements

- Toast must be announced through the existing Radix toast live region.
- Action buttons must be keyboard reachable.
- Do not rely only on color to communicate status.
- Use clear text labels: “Memory Ready”, “Paused”, “Model unavailable”.
- Keep toast text short enough for mobile and narrow desktop windows.

## MVP Acceptance Criteria

- A `silent_learner.memory_ready` event can trigger an in-app toast.
- The toast includes privacy-safe copy and memory count.
- The toast links to the future lesson review surface or a placeholder route/setting.
- The notification appears once per workspace for the first ready event.
- No notification appears when zero memory items are created.
- Redaction failure produces a caution notification, not a success notification.
- All copy avoids implying full model fine-tuning unless an adapter/model is actually ready.

## Implementation Notes

Recommended first code path:

1. Add a frontend listener/hook for Silent Learner status events.
2. Reuse `useToast` from `src/hooks/use-toast.ts`.
3. Store per-workspace notification acknowledgement locally so the ready toast does not repeat.
4. Add a temporary action target to settings until a dedicated lesson review page exists.
5. Later replace the temporary route with the full Silent Learner review panel.

Pseudo-code:

```ts
if (
  event.type === 'silent_learner.memory_ready' &&
  event.memoryItemCount > 0 &&
  !hasNotifiedWorkspace(event.workspaceId)
) {
  toast({
    title: 'Silent Learner is ready',
    description: `ProductOS learned ${event.memoryItemCount} local lesson(s) from your recent work. Future AI tasks can now reuse them privately.`,
    action: reviewLessonsAction,
  });

  markWorkspaceNotified(event.workspaceId);
}
```
