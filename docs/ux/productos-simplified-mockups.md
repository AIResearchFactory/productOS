# ProductOS Simplified IA Mockups

These mockups translate the simplification brief into concrete screen structures. They are intentionally low-fidelity so the team can agree on hierarchy and behavior before polishing visuals or changing components.

## Global shell

### Intent

Reduce ProductOS to one clear product workspace with four core work surfaces and one settings area.

### Proposed shell

```text
+--------------------------------------------------------------------------------+
| ProductOS        My Product                         Search / Cmd-K   Ask Copilot |
+--------------------------------------------------------------------------------+
| Home        |                                                                  |
| Context     |  Active surface content                                          |
| Outputs     |                                                                  |
| Automations |                                                                  |
| Settings    |                                                                  |
+-------------+------------------------------------------------------------------+
```

### Behavior

- Product switcher lives in the top bar next to the current product name.
- The left rail is always visible but narrow and text-first, not icon-heavy.
- `Ask Copilot` is a persistent top-level action, not an always-open competing panel.
- Settings is last and visually separated from product work.

### Navigation labels

| Current | Proposed | Reason |
| --- | --- | --- |
| Products | Home / Product switcher | Product list is contextual, not a work surface. |
| Artifacts | Outputs | More user-facing and PM-friendly. |
| Skills | Automations | Skills are reusable automation building blocks. |
| Workflows | Automations | Workflows and schedules belong together. |
| Models | Settings | Configuration should not compete with PM work. |

## Mockup 1: Product Home

### Goal

Show the product state, one recommended next action, and recent activity without duplicating every workspace capability.

```text
+--------------------------------------------------------------------------------+
| ProductOS   My Product v                         Search / Cmd-K   Ask Copilot  |
+--------------------------------------------------------------------------------+
| Home        | Product Home                                                     |
| Context     | Initial product workspace                         Product settings |
| Outputs     |                                                                  |
| Automations | +--------------------------------------------------------------+ |
| Settings    | | NEXT BEST ACTION                                             | |
|             | | Create first output from existing context                    | |
|             | | You have 4 context files and 0 current PRDs.                 | |
|             | |                                                              | |
|             | | [Create PRD]   [Ask Copilot why]                             | |
|             | +--------------------------------------------------------------+ |
|             |                                                                  |
|             | +------------------+ +------------------+ +------------------+   |
|             | | Context          | | Outputs          | | Automations      |   |
|             | | 4 files ready    | | 4 docs           | | 4 workflows      |   |
|             | | [Open context]   | | [Review docs]    | | [Manage]         |   |
|             | +------------------+ +------------------+ +------------------+   |
|             |                                                                  |
|             | Recent work                                                       |
|             | - competitors.md updated                                           |
|             | - Roadmap Template opened                                          |
|             | - Weekly research workflow completed                               |
+-------------+------------------------------------------------------------------+
```

### Component hierarchy

1. Product identity and settings link
2. Next best action card
3. Readiness summary cards
4. Recent work
5. Secondary recommendations, only if space allows

### States

- **Empty product**: CTA = `Add context`
- **Context only**: CTA = `Create first output`
- **Outputs exist**: CTA = `Automate recurring work`
- **Mature product**: CTA = `Ask Copilot for next actions`
- **Error state**: Show degraded readiness cards with retry buttons per area

## Mockup 2: Context

### Goal

Make source material easy to add, scan, and use as Copilot context.

```text
+--------------------------------------------------------------------------------+
| ProductOS   My Product v                         Search / Cmd-K   Ask Copilot  |
+--------------------------------------------------------------------------------+
| Home        | Context                                                          |
| Context     | Files, notes, specs, transcripts, and research that power AI.   |
| Outputs     |                                                                  |
| Automations | [Add file] [Import folder] [Paste notes]                         |
| Settings    |                                                                  |
|             | +--------------------------+ +---------------------------------+ |
|             | | Source library           | | Preview                         | |
|             | | Search files...          | | competitors.md                  | |
|             | |                          | |                                 | |
|             | | README.md                | | Key competitors, positioning,   | |
|             | | competitors.md  Selected | | pricing notes...                | |
|             | | personas.md              | |                                 | |
|             | | context-personal.md      | | [Use in Copilot] [Make output]  | |
|             | +--------------------------+ +---------------------------------+ |
+-------------+------------------------------------------------------------------+
```

### Key simplification

Context replaces the current mixed product/file/project list. It answers one question: "What source material does this product have?"

### Empty state copy

> Add the first piece of product context. Start with a spec, customer note, transcript, competitor page, or rough idea. ProductOS will use this as source material for outputs and automations.

Primary CTA: `Add context`

## Mockup 3: Outputs

### Goal

Make generated PM deliverables feel like the main value, not internal artifacts.

```text
+--------------------------------------------------------------------------------+
| ProductOS   My Product v                         Search / Cmd-K   Ask Copilot  |
+--------------------------------------------------------------------------------+
| Home        | Outputs                                                          |
| Context     | Product docs generated from your context.                       |
| Outputs     |                                                                  |
| Automations | [Create output] [Import doc]                                     |
| Settings    |                                                                  |
|             | Filters: All  PRDs  Roadmaps  Research  One-pagers  Decks        |
|             |                                                                  |
|             | +----------------------+ +----------------------+ +-------------+ |
|             | | Current Product      | | Competitor Snapshot | | Roadmap     | |
|             | | Status               | | One-pager           | | Template    | |
|             | | Updated 2d ago       | | Updated 5d ago      | | Template    | |
|             | | [Open] [Refresh]     | | [Open] [Refresh]    | | [Use]       | |
|             | +----------------------+ +----------------------+ +-------------+ |
+-------------+------------------------------------------------------------------+
```

### Create output menu

```text
Create output
- PRD
- Roadmap
- Competitive analysis
- User insight summary
- Launch initiative
- One-pager
- Presentation
```

### Empty state copy

> Turn context into a product deliverable. Start with a PRD, roadmap, insight summary, or competitive analysis.

Primary CTA: `Create first output`

## Mockup 4: Automations

### Goal

Combine workflows, schedules, and reusable skills into one product automation surface.

```text
+--------------------------------------------------------------------------------+
| ProductOS   My Product v                         Search / Cmd-K   Ask Copilot  |
+--------------------------------------------------------------------------------+
| Home        | Automations                                                      |
| Context     | Recurring product work, reusable skills, and scheduled workflows. |
| Outputs     |                                                                  |
| Automations | [New automation] [Browse reusable tools]                         |
| Settings    |                                                                  |
|             | +--------------------------------------------------------------+ |
|             | | Weekly competitor scan                         Scheduled      | |
|             | | Reads competitor docs, summarizes changes, updates output.    | |
|             | | Last run: yesterday       [Run now] [Edit] [Pause]            | |
|             | +--------------------------------------------------------------+ |
|             |                                                                  |
|             | +--------------------------------------------------------------+ |
|             | | PRD review checklist                             Manual        | |
|             | | Reusable skill for checking completeness and risks.           | |
|             | | [Run] [Edit]                                                 | |
|             | +--------------------------------------------------------------+ |
+-------------+------------------------------------------------------------------+
```

### New automation flow

```text
New automation
1. What should repeat?
   - Research scan
   - Output refresh
   - Review/checklist
   - Custom workflow
2. What context should it use?
3. What output should it update/create?
4. Does it need approval before writing?
5. Schedule or run manually?
```

### Empty state copy

> Automate a product chore. ProductOS can monitor research, refresh docs, run checklists, and prepare updates with approval.

Primary CTA: `Create automation`

## Mockup 5: Copilot composer

### Goal

Make Copilot available everywhere without permanently consuming screen width.

```text
+------------------------------------------------------------------------------+
| Ask Copilot                                                                  |
|------------------------------------------------------------------------------|
| What do you want to do with My Product?                                      |
|                                                                              |
| [ Summarize current state and suggest next actions...                    ]    |
|                                                                              |
| Context: My Product  + competitors.md  + Current Product Status              |
|                                                                              |
| Suggestions                                                                  |
| - Create a PRD from selected context                                          |
| - Compare roadmap against competitor snapshot                                 |
| - Turn this into a weekly automation                                          |
+------------------------------------------------------------------------------+
```

### Behavior

- Opens as a modal, drawer, or command palette.
- User can attach files/outputs explicitly.
- Suggestions are based on the current surface.
- Approval-required actions show a clear confirmation card before writing files or running automations.

## Visual direction

Keep the current dark command-center feel, but reduce card density and use stronger hierarchy.

### Tokens

```text
color.background      #080b0d
color.surface         #0f1417
color.surfaceRaised   #151c20
color.border          rgba(255,255,255,0.10)
color.textPrimary     #f4f7f6
color.textSecondary   #a8b3af
color.accent          #6ee7b7
color.accentMuted     rgba(110,231,183,0.12)
color.warning         #fbbf24
color.danger          #fb7185

space.1  4px
space.2  8px
space.3  12px
space.4  16px
space.5  20px
space.6  24px
space.8  32px

radius.sm  8px
radius.md  12px
radius.lg  16px
radius.xl  24px

font.ui      Inter / system-ui
font.mono    JetBrains Mono / ui-monospace
```

### Accessibility notes

- All navigation buttons need `aria-current="page"` when active.
- Copilot drawer/modal needs focus trap and Escape close.
- Focus rings should use a visible accent outline, not color-only state.
- Empty/loading/error cards should include actionable text, not only icons.
- Readiness status should include labels like `Ready`, `Needs context`, `Needs output`, not only colored dots.
