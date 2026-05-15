# ProductOS Compact Layout, Collapse, and Icon System

This spec adds the missing simplification layer: how ProductOS should minimize, collapse, and iconize the workspace so the UI can feel powerful without feeling crowded.

## Goals

1. Let users reduce visual noise without losing orientation.
2. Support focused PM work on smaller screens and dense desktop sessions.
3. Make navigation scannable through stable icons, labels, and tooltips.
4. Allow Copilot, source preview, and detail panels to be opened only when needed.
5. Preserve accessibility: icon-only controls still need labels, keyboard access, and focus states.

## Layout modes

### 1. Full mode

Best for first-time users and large screens.

```text
+--------------------------------------------------------------------------------+
| Top bar: ProductOS / Product switcher / Search / Ask Copilot                   |
+--------------------------------------------------------------------------------+
| Home        | Main content                                                     |
| Context     |                                                                  |
| Outputs     |                                                                  |
| Automations |                                                                  |
| Settings    |                                                                  |
+-------------+------------------------------------------------------------------+
```

Rules:
- Left nav shows icons + labels.
- Product name is visible in the top bar.
- Main surface shows full headings and explanatory copy.
- Copilot is closed by default unless the user opens it.

### 2. Compact mode

Best for returning users and medium-width screens.

```text
+--------------------------------------------------------------------------------+
| Product switcher                         Search                    Copilot icon |
+--------------------------------------------------------------------------------+
| H | Main content                                                              |
| C |                                                                           |
| O |                                                                           |
| A |                                                                           |
| S |                                                                           |
+---+---------------------------------------------------------------------------+
```

Rules:
- Left nav becomes icon-first with short labels hidden.
- Tooltip appears on hover/focus.
- Active item keeps both icon highlight and `aria-current="page"`.
- Page heading remains visible so orientation is not lost.

### 3. Focus mode

Best for writing, reviewing outputs, or working in Copilot.

```text
+--------------------------------------------------------------------------------+
| Product / breadcrumb                                           Exit focus mode |
+--------------------------------------------------------------------------------+
| Main document or Copilot action                                                |
|                                                                                |
|                                                                                |
+--------------------------------------------------------------------------------+
```

Rules:
- Left nav collapses completely.
- Secondary side panels close.
- Top bar shows breadcrumb + exit control.
- Keyboard shortcut: `Esc` exits drawer/modal first, then focus mode.

### 4. Split mode

Best for comparing source context and output.

```text
+--------------------------------------------------------------------------------+
| Compact nav | Context/source column | Output/review column | Copilot drawer    |
+--------------------------------------------------------------------------------+
```

Rules:
- Use only when user explicitly opens preview or Copilot.
- Columns are resizable within sane min/max widths.
- Each column can be collapsed independently.

## Collapsible regions

| Region | Default | Collapse behavior | Restore behavior |
| --- | --- | --- | --- |
| Left nav | Full on desktop, compact on tablet | Icon rail, then hidden in focus mode | Click rail expander or keyboard shortcut |
| Product switcher | Closed | Shows only active product | Opens popover list/search |
| Copilot | Closed | Icon button in top bar | Opens drawer/composer |
| Context preview | Closed unless selected | Preview column hidden | Opens from file click or `Preview` button |
| Output source trace | Closed | Trace chip visible | Opens trace panel |
| Recent work | Visible on Home | Collapses to count/status chip | Expands inline |

## Icon system

Use stable, semantic icons. Do not rotate icon meanings between screens.

| Surface/action | Icon concept | Label | Notes |
| --- | --- | --- | --- |
| Home | House / dashboard | Home | Product state and next action |
| Context | Circle nodes / database / document stack | Context | Source material |
| Outputs | Document / square stack | Outputs | Generated PM docs |
| Automations | Loop / bolt / workflow arrow | Automations | Recurring work |
| Settings | Gear | Settings | Configuration |
| Copilot | Sparkle / command star | Ask Copilot | Action layer |
| Add context | Plus + document | Add context | Primary empty-state CTA |
| Refresh output | Refresh arrows | Refresh | Stale outputs |
| Source trace | Branch / link / timeline | Source trace | Auditability |
| Approval required | Shield / check badge | Approval required | Before write/external action |
| Stale warning | Amber clock / alert | Stale | Needs refresh |

## Icon-only accessibility rules

- Every icon-only button needs `aria-label`.
- Tooltips appear on hover and keyboard focus.
- Active navigation uses `aria-current="page"`.
- Badges include visible text (`Stale`, `Fresh`, `Approval required`) instead of color-only dots.
- Focus ring: 2px mint or cyan outline with 2px offset.
- Minimum target size: 40x40px desktop, 44x44px touch.

## Compact navigation behavior

### Desktop >= 1200px

- Default: full nav, 214px wide.
- User can collapse to 72px icon rail.
- Preference persists per device in local storage.

### Tablet 768-1199px

- Default: compact icon rail.
- Labels available through tooltips.
- Product switcher moves into top bar.

### Mobile < 768px

- No permanent side rail.
- Bottom nav with 4 product work items:
  - Home
  - Context
  - Outputs
  - Automations
- Settings moves into top-right overflow.
- Copilot is a floating action button or bottom sheet.

## Column behavior

### Context + output comparison

When a user creates or refreshes an output from context:

```text
+-----------------------------------------------------------------------------+
| Icon rail | Context preview                 | Draft output                  |
|          | competitors.md                  | Competitor Snapshot update    |
|          | selected source passages         | generated changes             |
+-----------------------------------------------------------------------------+
```

Rules:
- Context column width: 320-460px.
- Output column takes remaining width.
- Source chips stay visible above the draft.
- `Save output` remains the only primary CTA.

### Copilot drawer

```text
+---------------------------------------------------------------+---------------+
| Current screen                                                 | Copilot       |
|                                                               | prompt        |
|                                                               | context chips |
|                                                               | suggestions   |
+---------------------------------------------------------------+---------------+
```

Rules:
- Drawer width: 420-560px desktop.
- On smaller screens, drawer becomes modal/bottom sheet.
- User can pin Copilot if they prefer persistent chat.
- Default should be unpinned/closed to reduce clutter.

## Minimize affordances

Use consistent controls:

| Control | Placement | Behavior |
| --- | --- | --- |
| Collapse nav | Bottom of left rail | Toggles full/compact rail |
| Pin Copilot | Copilot header | Keeps drawer open across screens |
| Hide preview | Preview panel header | Closes context/detail column |
| Focus mode | Output/editor toolbar | Hides nav and secondary panels |
| Restore layout | Top bar or keyboard shortcut | Returns to previous mode |

## Keyboard shortcuts

| Shortcut | Behavior |
| --- | --- |
| `Cmd/Ctrl + K` | Open command/search |
| `Cmd/Ctrl + J` | Toggle Copilot drawer |
| `Cmd/Ctrl + B` | Toggle nav collapse |
| `Cmd/Ctrl + .` | Toggle source trace / preview panel |
| `Esc` | Close drawer/modal, then exit focus mode |

## Acceptance criteria

- Main navigation can collapse to icon-only without losing accessibility.
- Copilot can be minimized, opened as drawer/modal, and optionally pinned.
- Context preview/source trace can collapse independently.
- The selected layout mode persists locally.
- Mobile has a bottom-nav equivalent instead of a squeezed sidebar.
- Visual mockups include at least one compact/icon-only screen and one split-column flow.
