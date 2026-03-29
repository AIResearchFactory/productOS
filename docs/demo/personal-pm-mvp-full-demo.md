# productOS Personal PM MVP — Full Demo Script

This demo covers the 3 implemented MVP capabilities end-to-end:

1. Personal PM Setup during onboarding
2. Personal Starter Pack installation
3. Artifact Quality Check guardrails

Branch: `feature/token-saver-integration`

---

## Demo goals

By the end of the demo, you should be able to prove:

- Personal context fields are collected in onboarding.
- A first project is bootstrapped from onboarding.
- Starter pack workflows and templates are created.
- Artifact quality guardrails can detect missing required sections.

---

## Preconditions

- Build from branch `feature/token-saver-integration`
- Start desktop app (recommended demo path):
  - `npm install`
  - `npm run tauri dev`

> Note: this demo is intended for the desktop app flow.

---

## Demo flow (operator script)

### Step 1 — Setup wizard and provider selection

1. Open app.
2. Continue through:
   - Workspace Location (app config)
   - Workspace Location (projects)
   - Select AI Providers
3. Select 1+ providers (e.g., Gemini + Claude).
4. Continue.

Expected:
- If dependencies are missing, "Install Dependencies" appears.
- Continue should still lead to Personal PM setup step.

---

### Step 2 — Personal PM Setup (new capability)

On "Personal PM Setup" screen, fill:

- Product Name: `Demo Product`
- Product Goal: `Increase activation by 20%`
- Company: `Acme`
- Primary Persona (seed): `SMB Product Manager`
- Top Competitors (seed): `Notion, Asana, ClickUp`
- Keep "Install Personal PM Starter Pack" checked

Click Continue.

Expected:
- Installation finalizes.
- Personal bootstrap runs.
- Workspace opens successfully.

---

### Step 3 — Verify generated assets

In workspace, verify the following were created for the new project:

#### Context seed
- `context-personal.md` contains product context (company, product, current goal)
- `personas.md` is scaffolded for multiple personas (editable)
- `competitors.md` is scaffolded as an editable competitors table

#### Starter pack workflows
- PRD Draft Workflow
- Competitor Snapshot Workflow
- Launch Brief Workflow

#### Starter artifacts
- PRD Template
- Roadmap Template

---

### Step 4 — Artifact Quality Check (new capability)

1. Open `PRD Template` (or any PRD markdown artifact).
2. Click `Quality Check` button in editor toolbar.

Expected:
- If sections are missing, issues panel appears with missing headings (e.g. Requirements, Success Metrics).
- If sections are complete, success toast appears.

---

## Failure/edge behavior demo

### A) Missing provider dependencies

- Keep a provider selected but not installed/authenticated.
- In Install Dependencies step, continue anyway.

Expected:
- Onboarding still completes.
- Workspace opens.
- Missing provider is simply unavailable until fixed.

### B) Multi-provider selection

- Select multiple providers.

Expected:
- `selectedProviders` is persisted.
- `activeProvider` is set deterministically during setup (priority: Claude → Gemini → OpenAI → Ollama).
- Runtime falls back if the chosen provider is unavailable.

---

## Acceptance checklist

- [ ] Personal PM Setup step appears in onboarding flow.
- [ ] Personal fields persist into generated context file.
- [ ] Starter pack installs workflows and templates.
- [ ] Quality Check button visible in markdown editor.
- [ ] Quality issues shown for incomplete PRD/roadmap docs.
- [ ] Onboarding is resilient even when provider dependencies are missing.

---

## Related implementation commits

- `0ca1ebb` — personal onboarding + starter pack + artifact quality checks
- `ea3f010` — personal step integrated into Installation Wizard and dependency instructions hardened

---

## Optional live narration (30-60 sec)

"In this demo we onboard an individual PM, collect personal product context, auto-bootstrap a usable workspace with starter workflows/templates, and run quality guardrails on artifacts. This reduces setup time, improves first-run value, and raises output consistency."
