# Case 04 — PRD vs Backlog Alignment (MCP)

## Goal
Detect drift between planning docs and delivery backlog.

## Demo Prompt
```
Compare @smart-notifications-prd-v1.md with current GitHub issues/milestones.
Identify:
1) requirements not represented in backlog
2) tickets that are out-of-scope
3) recommended ticket updates
```

## Expected Output Artifact
- `prd-backlog-alignment-report.md`

## Success Criteria
- Lists missing tickets
- Flags out-of-scope backlog items
- Provides actionable update list
