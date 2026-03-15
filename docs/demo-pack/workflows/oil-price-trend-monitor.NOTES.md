# Oil Price Trend Monitor Workflow Notes

## Purpose
This workflow is a "magic workflow" template to monitor oil price trends and explain likely causes of movement.

## Schedule
- Cron: `0 */4 * * *`
- Meaning: runs every 4 hours, on the hour
- Timezone: `Asia/Jerusalem`

## Skill prerequisites
Before running, ensure these skills exist in your project (or map to your equivalents):
- `market_research_analyst`
- `report_writer`

If your skill names differ, edit `skill_id` fields in the JSON.

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
