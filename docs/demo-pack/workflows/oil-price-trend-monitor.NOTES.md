# Oil Price Trend Monitor Workflow Notes

## Purpose
This workflow is a "magic workflow" template to monitor oil price trends and explain likely causes of movement.

## Schedule
- Cron: `0 */4 * * *`
- Meaning: runs every 4 hours, on the hour
- Timezone: `Asia/Jerusalem`

## Skill prerequisites
Base template (`oil-price-trend-monitor.workflow.json`) expects:
- `market_research_analyst`
- `report_writer`

If your skill names differ, use the auto-generator script below.

## Auto-map to installed skills (recommended)
Run from repo root:

```powershell
./scripts/generate-oil-workflow-from-installed-skills.ps1
```

This generates:
- `oil-price-trend-monitor.autogen.workflow.json`

The generated file is mapped to the actual installed `skill_id`s found in:
`C:\Users\User\AppData\Roaming\ai-researcher\skills\.metadata`

## How to use in productOS
1. Open **Flows** in your target project.
2. Import JSON from `oil-price-trend-monitor.workflow.json`.
3. Open schedule panel and confirm cron/timezone.
4. Run once manually to validate outputs.
5. Leave schedule enabled for automatic 4-hour runs.

## Expected outputs
- `oil-trend-summary.md`
- `oil-brief-latest.md`
- intermediate signal/source files per run
