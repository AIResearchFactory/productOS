# productOS Cookbook: Practical Use Cases & Demo Playbook

[← Previous: Artifacts Guide](10-artifacts-guide.md) | [Back to Documentation Home](README.md)

---

## Purpose

This cookbook is a hands-on guide for using productOS in real product-management workflows.

For each recipe, you get:
- **When to use it**
- **What features it uses**
- **Exact example prompts / inputs**
- **Expected outputs**
- **Business leverage (time saved, quality gains)**

---

## productOS in 60 seconds (Overview)

productOS is strongest when you combine these building blocks:

1. **Projects** → keep one initiative’s context together.
2. **Chat** → fast exploration and drafting.
3. **Skills** → repeatable specialist behavior.
4. **Workflows** → multi-step automation and parallel processing.
5. **Artifacts** → persistent deliverables (PRDs, tables, reports).
6. **MCP** → connect external systems (GitHub, web, etc.) for richer context.

The leverage model is simple:
- Use **chat** for one-off tasks,
- Use **skills** for repeatable tasks,
- Use **workflows** for recurring multi-step work,
- Store outputs as **artifacts** for team reuse.

---

## Recipe 1 — Fast Feature Discovery Brief

### Use case
You need a quick but structured brief before deciding whether to invest in a feature.

### Features used
Projects + Chat + Artifacts

### Steps
1. Create project: `Feature Discovery - Smart Notifications`.
2. Add a file `context.md` with goals/constraints.
3. In chat, use:

```text
Read @context.md and create a discovery brief for "Smart Notifications".
Include:
1) user problems
2) top 3 hypotheses
3) risks
4) what to validate this week
5) recommendation: build / test / drop
```

### Expected output
- One structured artifact: `smart-notifications-discovery-brief.md`

### Leverage
- 60–90 min thinking/composition compressed to ~15 min.

---

## Recipe 2 — Competitor Deep Dive (Single Company)

### Use case
Need a decision-ready analysis of one competitor for strategy review.

### Features used
Skills + Chat + Artifacts

### Steps
1. Use/create skill: `Competitive Analyst`.
2. In chat:

```text
Using Competitive Analyst skill, analyze Notion for product strategy comparison.
Focus on: onboarding, collaboration, AI features, pricing, enterprise readiness.
Output a SWOT and recommended response strategy for our product.
```

### Expected output
- `notion-competitive-analysis.md`
- SWOT section + strategic recommendations.

### Leverage
- Better consistency than ad-hoc prompting.
- Reusable structure for every competitor.

---

## Recipe 3 — Multi-Competitor Benchmark (Parallel Workflow)

### Use case
Quarterly market benchmark across 5–10 competitors.

### Features used
Workflows + Skills + Parallel iteration + Artifacts

### Workflow shape
1. **Input Step**: competitor list.
2. **Iteration Step (parallel=true)**: one run per competitor.
3. **Agent Step**: `Competitive Analyst` per item.
4. **Synthesis Step**: merge into comparison table + insights.

### Example input list
```text
Notion
Coda
Airtable
Monday
ClickUp
```

### Example synthesis prompt
```text
Synthesize all competitor reports into:
1) feature matrix
2) pricing matrix
3) enterprise-readiness score (1-5)
4) strategic gaps we should exploit next quarter.
```

### Expected outputs
- `competitor-<name>.md` per company
- `competitive-comparison.md`
- Optional artifact: `q2-strategy-recommendations.md`

### Leverage
- Typical 6–8h manual process down to ~30–60 min.

---

## Recipe 4 — PRD Generator from Research Notes

### Use case
Convert discovery/research into implementation-ready PRD draft.

### Features used
Chat + `@file` references + Artifacts

### Steps
Use:

```text
Use @smart-notifications-discovery-brief.md and @competitive-comparison.md.
Generate a PRD with:
- problem statement
- target users
- scope (in/out)
- user stories
- acceptance criteria
- success metrics
- rollout plan
```

### Expected output
- `smart-notifications-prd-v1.md`

### Leverage
- Faster transition from strategy to execution docs.

---

## Recipe 5 — Ticket Readiness / Scope QA

### Use case
Before engineering kickoff, verify that PRD is testable and complete.

### Features used
Chat + Skills + Artifacts

### Example prompt
```text
Review @smart-notifications-prd-v1.md as a senior PM + QA reviewer.
Return:
1) ambiguous requirements
2) missing edge cases
3) non-testable acceptance criteria
4) rewritten acceptance criteria in Given/When/Then format.
```

### Expected output
- `smart-notifications-prd-review.md`
- optionally `smart-notifications-prd-v2.md`

### Leverage
- Fewer back-and-forth cycles during sprint planning.

---

## Recipe 6 — Customer Interview Synthesis

### Use case
You have multiple call notes and need themes + actionable priorities.

### Features used
Projects + Files + Workflow iteration + Synthesis

### Inputs
- `interview-01.md` ... `interview-10.md`

### Pattern
- Iterate over interview notes in parallel
- Extract pain points/jobs-to-be-done/quotes
- Synthesize into a single insights doc

### Example synthesis request
```text
Combine all interview summaries into:
- top 5 recurring pains
- evidence snippets (quotes)
- severity/frequency matrix
- suggested roadmap themes for next quarter.
```

### Expected output
- `customer-insights-qX.md`

### Leverage
- Turns raw qualitative data into prioritization input quickly.

---

## Recipe 7 — Weekly Product Intelligence Digest

### Use case
Recurring executive update on market + product signals.

### Features used
Workflow scheduling + Chat + Artifacts (+ optional MCP web/GitHub)

### Setup
1. Build workflow for sources you care about (competitors, docs, releases).
2. Schedule it weekly.
3. Output one summary artifact.

### Example digest format
```text
# Weekly Product Intelligence
- What changed this week
- Why it matters
- Risk/opportunity for us
- Recommended PM actions
```

### Expected output
- `weekly-product-intel-YYYY-MM-DD.md`

### Leverage
- Reliable cadence without rebuilding context from scratch each week.

---

## Recipe 8 — Cross-Tool Validation (MCP-enabled)

### Use case
Validate strategy docs against external systems (e.g., GitHub backlog status).

### Features used
MCP + Chat + Artifacts

### Example prompt
```text
Compare @smart-notifications-prd-v2.md with current GitHub issues/milestones.
Identify:
1) requirements not represented in backlog
2) tickets that are out-of-scope
3) recommended ticket updates.
```

### Expected output
- `prd-backlog-alignment-report.md`

### Leverage
- Reduces execution drift between planning docs and delivery system.

---

## Demo Script (30-minute live walkthrough)

Use this when showing productOS to stakeholders.

1. **(3 min)** Create project + add `context.md`.
2. **(5 min)** Run Recipe 1 prompt → show artifact creation.
3. **(7 min)** Trigger competitor workflow (Recipe 3) with 3 competitors.
4. **(5 min)** Open generated comparison artifact.
5. **(5 min)** Generate PRD from artifacts (Recipe 4).
6. **(5 min)** Run PRD quality review (Recipe 5).

### Demo success criteria
- At least 3 artifacts generated live.
- One end-to-end path from idea → analysis → PRD.
- Clear before/after productivity narrative.

---

## Suggested Starter Skill Pack

For most PM teams, start with these 5 skills:
1. Research Assistant
2. Competitive Analyst
3. PRD Generator
4. Document Summarizer
5. QA Requirement Reviewer

This is enough to power all recipes above.

---

## Common mistakes (and fixes)

- **Mistake:** Trying to automate from day 1.
  - **Fix:** Do task manually once in chat, then convert to skill/workflow.

- **Mistake:** Skills too generic.
  - **Fix:** Add strict output structure and examples.

- **Mistake:** No synthesis step in workflows.
  - **Fix:** Always add one final step that turns many outputs into one decision doc.

- **Mistake:** Outputs remain in chat only.
  - **Fix:** Ask for artifact creation and stable filenames.

---

## KPI ideas to measure productOS impact

Track these monthly:
- Cycle time from idea → PRD draft
- Hours saved on recurring research
- % of PRDs requiring major rewrite after engineering review
- Number of reusable workflows/skills adopted by team

---

[← Previous: Artifacts Guide](10-artifacts-guide.md) | [Back to Documentation Home](README.md)
