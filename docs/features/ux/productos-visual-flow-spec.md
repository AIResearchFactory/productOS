# ProductOS Visual UX Flow Spec

This spec complements the visual mockups with interaction-level behavior. It focuses on what the user sees, what the primary CTA should be, and how Ask ProductOS/approval flows should behave.

## Flow 1: Empty product to first output

| Step | Screen | Visual state | Primary CTA | Secondary actions |
| --- | --- | --- | --- | --- |
| 1 | Home | Empty readiness: Context 0, Outputs 0, Automations 0 | Add context | Ask Ask ProductOS, Use template |
| 2 | Context | Empty source library with upload/paste affordances | Add context | Paste notes, Import folder |
| 3 | Context | File appears as Ready with preview | Create output | Attach to Ask ProductOS |
| 4 | Outputs | Create output modal/drawer with doc types | Create PRD | Roadmap, One-pager, Research summary |
| 5 | Ask ProductOS composer | Context chips visible; draft action described | Generate draft | Change context |
| 6 | Output review | Draft with source trace and diff/save controls | Save output | Edit draft, Regenerate |
| 7 | Home | Readiness updates; next CTA becomes Automate recurring work | Create automation | Ask Ask ProductOS next actions |

### UX notes

- Do not mention Skills or Workflows during the first-output path.
- If no AI provider is available, keep the user in context and show an inline setup card.
- The save action should be visually distinct from generation; generation creates a draft, save writes the output.

## Flow 2: Mature product daily review

| Step | Screen | Visual state | Primary CTA | Secondary actions |
| --- | --- | --- | --- | --- |
| 1 | Home | Next-best-action card highlights stale output | Refresh output | Ask Ask ProductOS why |
| 2 | Outputs | Stale badge on affected output | Refresh | Open, View trace |
| 3 | Ask ProductOS composer | Attached stale output + changed context | Draft refresh | Create automation |
| 4 | Review diff | Before/after update with source trace | Save update | Reject, Edit, Regenerate |
| 5 | Home | Output status becomes Fresh | Review next action | Open recent work |

### UX notes

- Amber is reserved for stale/warning states.
- Stale status should include the reason: e.g. `competitors.md changed today`.
- Product Home should not show more than one amber warning at hero level; additional warnings belong in Recent work or detail views.

## Flow 3: Create automation from repeated work

| Step | Screen | Visual state | Primary CTA | Secondary actions |
| --- | --- | --- | --- | --- |
| 1 | Automations | Empty or list of automations | New automation | Browse reusable tools |
| 2 | New automation wizard | Choose chore type | Continue | Start from workflow canvas |
| 3 | Context selection | Source files and outputs selectable | Continue | Add context |
| 4 | Output target | Choose update/create/summary behavior | Continue | Skip output |
| 5 | Approval settings | Explicit approval cards | Save automation | Run once first |
| 6 | Schedule | Manual/daily/weekly/on-change choices | Save | Manual only |
| 7 | Automation detail | Shows status, last run, next run, approvals | Run now | Edit, Pause |

### UX notes

- Start with product chores, not nodes.
- Keep the canvas as an advanced editor after the automation exists.
- Approval settings must include plain-language examples:
  - `Ask before writing files`
  - `Ask before sending external messages`
  - `Ask before opening GitHub/Jira work`

## Flow 4: AI provider blocker

| Step | Screen | Visual state | Primary CTA | Secondary actions |
| --- | --- | --- | --- | --- |
| 1 | Any generate action | Inline blocker card appears | Configure AI provider | Learn local/private options |
| 2 | Settings > Models | Provider cards with readiness badges | Connect selected provider | Use Ollama guide |
| 3 | Provider setup | Auth/key/CLI status visible | Test connection | Cancel |
| 4 | Return to prior action | Original draft/generate context restored | Continue generation | Change provider |

### UX notes

- Models should not be a primary daily nav item.
- The blocker should explain local vs hosted provider implications.
- After setup succeeds, return the user to the exact action they attempted.

## Flow 5: Source trace and audit

| Entry point | Destination | User question answered |
| --- | --- | --- |
| Output detail > Source trace | Output trace panel | What context created this doc? |
| Automation detail > Run history | Automation runs | What ran, when, and did it write anything? |
| Product Home > Recent work | Activity detail | What changed recently? |
| Settings/overflow > Full activity log | Global log | Exportable audit history |

### UX notes

- Research Log should become contextual first, global second.
- Source trace should show:
  - context files used
  - prompt/action summary
  - generated output/diff
  - approvals granted
  - timestamp and provider

## Color and state rules

| State | Color | Usage |
| --- | --- | --- |
| Primary action | Mint | Next CTA, Ask ProductOS run, successful readiness |
| Informational/context | Cyan | File/context affordances, source trace |
| Reusable/template | Violet | Templates, reusable tools, manual skills |
| Warning/stale | Amber | Stale outputs, approval needed, retryable blockers |
| Destructive/error | Rose | Failed runs, delete, irreversible actions |

## Accessibility rules

- Active nav item uses `aria-current="page"`.
- Ask ProductOS drawer has focus trap, Escape close, and clear heading.
- Status chips include text labels, not color-only indicators.
- Focus outline uses mint/cyan ring with at least 3:1 contrast against dark background.
- All primary flows have keyboard order: nav -> page heading -> primary CTA -> content list -> secondary actions.
