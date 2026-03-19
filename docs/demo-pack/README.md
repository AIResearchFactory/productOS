# productOS Demo Pack

This demo pack is a ready-to-run set of PM use-case scenarios for productOS demos.

## Included
- `cases/` — realistic scenario briefs and exact prompts
- `skills/` — starter skill templates
- `workflows/` — import-ready workflow JSON examples (including scheduled oil trend monitor every 4 hours)
- `captions/` — short on-screen captions for demo clips
- `simulation/` — script to simulate expected outputs and execution flow
- `remotion/` — Remotion scene project for visual walkthroughs

## Quick start
1. Open the corresponding case file in `cases/`.
2. Copy the prompt into productOS chat.
3. Run workflow from `workflows/` where relevant.
4. Use generated outputs as artifacts in your demo.

## One-click runner (Windows PowerShell)
From repo root:

```powershell
./docs/demo-pack/run-demo-pack.ps1
```

Optional flags:
- `-SkipSimulation`
- `-SkipStills`
- `-SkipVideo`

This will generate:
- `docs/demo-pack/simulation/out/*`
- `docs/demo-pack/remotion/out/case01.png` ... `case04.png`
- `docs/demo-pack/remotion/out/demo-pack.mp4`

## Cases
1. Feature discovery brief
2. Competitive benchmark (parallel workflow)
3. PRD generation from artifacts
4. PRD ↔ backlog alignment via MCP

