# ProductOS Natural Style and Icon Guide

This guide adds the missing tone layer Avia asked for: ProductOS should feel more natural, less system-heavy, and more icon-led without becoming cute or noisy.

## Style goal

ProductOS should feel like a calm product teammate, not an admin console.

The UI should say:

- I understand your product work.
- I know what needs attention.
- I can help you move the product forward.
- I will ask before doing anything risky.

It should avoid sounding like:

- A database manager.
- A generic AI dashboard.
- A workflow-engine control panel.
- A settings-heavy developer tool.

## Voice principles

### 1. Natural, direct, PM-friendly

Use plain product language:

| Avoid | Prefer |
| --- | --- |
| Artifact generated successfully | Your PRD is ready |
| Execute workflow | Run automation |
| Select artifact type | What do you want to create? |
| Ingest source document | Add context |
| Configure model provider | Connect AI provider |
| No entries found | Nothing here yet |
| Operation failed | That did not work |
| Retry operation | Try again |

### 2. Helpful, not chatty

Keep copy short, but make it human.

Bad:

> No artifacts exist in the current project. Create an artifact to continue.

Better:

> No outputs yet. Turn your product context into a PRD, roadmap, or research summary.

### 3. Action-first

Buttons should say what happens next.

| Weak | Better |
| --- | --- |
| Continue | Create PRD |
| Submit | Save output |
| Confirm | Approve and run |
| Open | Open source trace |
| Process | Refresh snapshot |

### 4. Calm confidence

Use reassurance around AI and approvals.

Examples:

- `Ask ProductOS will draft this first. You approve before anything is saved.`
- `This uses competitors.md and Current Product Status as context.`
- `Nothing will be sent outside ProductOS without approval.`

## Natural copy examples by screen

### Product Home

Hero title options:

- `My Product is ready for the next decision.`
- `You have enough context to create the first PRD.`
- `One output needs a refresh.`
- `Your weekly competitor scan is waiting for review.`

Next action copy:

```text
Refresh the competitive snapshot
competitors.md changed after this one-pager was created. Update it before planning the next roadmap revision.
```

Buttons:

- `Refresh output`
- `Ask ProductOS why`
- `Review latest work`

### Context

Empty state:

```text
Add your first product context
Start with a spec, notes, transcript, competitor research, or even a rough idea. ProductOS will use it to create outputs and automations.
```

Buttons:

- `Add context`
- `Paste notes`
- `Import folder`

### Outputs

Empty state:

```text
No outputs yet
Turn your context into a PRD, roadmap, one-pager, research summary, or launch doc.
```

Buttons:

- `Create PRD`
- `Create roadmap`
- `Ask ProductOS to recommend one`

### Automations

Empty state:

```text
Automate a product chore
Set up a weekly competitor scan, PRD review checklist, or recurring status update. ProductOS can draft changes and ask before saving.
```

Buttons:

- `Create automation`
- `Start from a checklist`
- `Browse reusable tools`

### AI provider blocker

```text
Ask ProductOS needs an AI provider
Connect Ollama, Gemini CLI, Claude Code, OpenAI, or another provider. Your product context stays local unless you choose a hosted provider.
```

Buttons:

- `Connect provider`
- `Use local setup guide`

## Icon philosophy

Icons should reduce reading load and help users build muscle memory. They should not replace meaning completely.

Rules:

1. Use one icon per concept consistently.
2. Pair icons with labels in full mode.
3. Use icon-only mode only after the user has clear orientation.
4. Every icon-only control needs tooltip + `aria-label`.
5. Avoid decorative icon clutter inside dense cards.

## ProductOS icon vocabulary

Recommended Lucide-style icon set:

| Concept | Icon direction | Label | Feeling |
| --- | --- | --- | --- |
| Home | Home / LayoutDashboard | Home | Product overview |
| Context | Files / Database / NotebookText | Context | Source material |
| Outputs | FileText / PanelsTopLeft | Outputs | Product docs |
| Automations | RefreshCw / Workflow / Repeat | Automations | Recurring work |
| Settings | Settings | Settings | Configuration |
| Ask ProductOS | Sparkles / WandSparkles | Ask ProductOS | Help/action |
| Add context | FilePlus / Upload | Add context | Bring source in |
| Create output | PenLine / FilePlus2 | Create output | Make a doc |
| Refresh stale output | RotateCw | Refresh output | Update |
| Source trace | GitBranch / ListTree | Source trace | Auditability |
| Approval | ShieldCheck | Approval required | Safety |
| Warning/stale | Clock3 / CircleAlert | Stale | Needs attention |
| Success/fresh | CircleCheck | Fresh | Ready |
| Collapse nav | PanelLeftClose | Collapse | Minimize |
| Expand nav | PanelLeftOpen | Expand | Restore |
| Focus mode | Maximize2 | Focus | Hide chrome |
| Exit focus | Minimize2 | Exit focus | Restore chrome |

## Icon + text pairings

Use the icon to support the sentence, not replace it.

Good:

```text
[RotateCw] Refresh output
competitors.md changed today.
```

Avoid:

```text
[RotateCw]
```

unless the user is in compact mode and the button has tooltip + accessible label.

## Natural information hierarchy

Each card should follow this order:

1. Icon/status
2. Human title
3. Why it matters
4. Primary action

Example:

```text
[Clock3] Competitor Snapshot is stale
competitors.md changed after this output was created.
[Refresh output]
```

## Microcopy rules

### Readiness labels

| Current/systemy | Natural |
| --- | --- |
| Ready | Ready |
| Next | Needs context / Needs output |
| Active | Running / Scheduled |
| Failed | Needs attention |
| Complete | Done |

### Time labels

Use human time:

- `Updated today`
- `Changed 12 minutes ago`
- `Last run yesterday`
- `Never run`

### AI action labels

Make AI actions honest:

- `Draft with Ask ProductOS`
- `Summarize with Ask ProductOS`
- `Ask ProductOS to compare`
- `Generate draft`
- `Review before saving`

Avoid implying hidden autonomy:

- `Auto-complete product strategy`
- `Run agent swarm`
- `Execute autonomous task`

## Button style recommendations

Primary buttons:

- Mint fill
- Verb + object
- One primary per screen

Secondary buttons:

- Soft outline
- Lower contrast
- Still clear

Danger/destructive:

- Rose/red only for irreversible or destructive actions
- Confirm with natural copy:
  - `Delete this output?`
  - `This removes the file from this product. You can export it first.`

## Empty/loading/error states

### Empty

Natural pattern:

```text
Nothing here yet
Add context to give ProductOS something useful to work with.
[Add context]
```

### Loading

```text
Loading your product context…
```

Avoid vague:

```text
Processing…
```

### Error

```text
That did not work
ProductOS could not load competitors.md. Try again or open the file location.
[Try again] [Open folder]
```

## Implementation acceptance criteria

- Main navigation uses stable icons and natural labels.
- Product Home hero copy is human and next-action based.
- Empty states use friendly PM-oriented language.
- Error states explain what failed and what the user can do next.
- Ask ProductOS actions say `draft`, `summarize`, `compare`, or `review` instead of vague AI verbs.
- Icon-only controls include aria labels and tooltips.
- No screen uses more than one primary CTA.
