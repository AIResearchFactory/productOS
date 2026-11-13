# Unit Test Plan: Socratic PM Intelligence (M1)

> **Feature**: `socratic-pm-harness`  
> **Milestone**: M1 (P0: Socratic Grilling Engine + On-Demand Critic Board)  
> **Pipeline Stage**: Unit Test Agent $\rightarrow$ Ready for Implementation & Review  
> **Reference Specs**: [qa-plan.md](./qa-plan.md) &bull; [backend-plan.md](./backend-plan.md) &bull; [frontend-plan.md](./frontend-plan.md)

---

## 1. Executive Summary & Scope

This plan specifies deterministic unit and integration test suites for all new and modified frontend components and backend services introduced in **Milestone 1 (P0)**.
All backend tests use Node's native test runner (`node --test`), and frontend components are tested with React Testing Library / Vitest.

---

## 2. Test Suite Inventory

```
node-backend/tests/
├── critics/
│   ├── critic-service.test.mjs          [NEW] Parallel audit orchestrator & scoring tests
│   ├── devils-pm.test.mjs               [NEW] The Devil's PM prompt & schema parser tests
│   ├── telemetry-guardian.test.mjs      [NEW] Telemetry Guardian parser & rules tests
│   └── tone-inspector.test.mjs          [NEW] Tone & avoided terms verification tests
└── socratic/
    ├── socratic-intent.test.mjs         [NEW] Intent classifier & proposal triggers
    └── socratic-turn.test.mjs           [NEW] Multi-turn state transitions & default assumptions

src/components/workspace/__tests__/
├── SocraticGrillCard.test.tsx           [NEW] Quick chip clicks, freeform text, and bypass
├── CriticReviewDrawer.test.tsx          [NEW] Severity tabs, 1-click apply fix, and dismiss
└── MarkdownEditor.critic.test.tsx       [NEW] Quality Check trigger & text replacement
```

---

## 3. Backend Unit Test Specifications

### 3.1 `critic-service.test.mjs`
- **Test 1: Parallel Execution & Scoring**:
  - Mock LLM responses for Devil's PM (1 critical), Telemetry (1 suggestion), Tone (clean).
  - Assert that `runArtifactAudit()` calls all 3 critics concurrently via `Promise.allSettled()`.
  - Assert `overallScore` is calculated accurately ($100 - 15 - 5 = 80$).
  - Assert structured response matches `CriticFinding[]` schema.
- **Test 2: Graceful Degradation on Provider Timeout**:
  - Inject an artificial timeout (simulate LLM delay $>8\text{ s}$) on Telemetry Guardian.
  - Assert that audit completes successfully with findings from the remaining 2 critics and attaches a non-fatal warning message.
- **Test 3: Schema Validation & Path Traversal Guard**:
  - Pass invalid `artifactPath: "../../../etc/passwd"`.
  - Assert backend rejects with HTTP 400 Bad Request.

### 3.2 `tone-inspector.test.mjs`
- **Test 1: Avoided Terms Detection**:
  - Provide content containing `"seamless integration"` and `"game-changing feature"`.
  - Provide project context with `avoided_keywords: ["seamless", "game-changing"]`.
  - Assert findings list contains Tone Inspector violation with precise quote and replacement suggestion.
- **Test 2: Domain Vocabulary Compliance**:
  - Verify that when project requires specific domain terms (e.g. `"workspace"` instead of `"project"`), deviations are flagged with suggested fixes.

---

## 4. Frontend Component Test Specifications

### 4.1 `SocraticGrillCard.test.tsx`
- **Test 1: Render Proposal & Bypass**:
  - Mount card in proposal state with `[Grill Me First]` and `[Generate Immediately]`.
  - Click `[Generate Immediately]` $\rightarrow$ verify `onBypassImmediately` callback is fired and telemetry `socratic.grilling_bypassed` is emitted.
- **Test 2: Quick-Option Chip Selection**:
  - Mount card at Step 1 with quick options `["100/min", "Standard 60/min", "Decide for me"]`.
  - Click `"100/min"` chip $\rightarrow$ verify `onAnswer` fired with `"100/min"` and mode `'chip'`.
- **Test 3: Freeform Text Input**:
  - Type custom answer in input field $\rightarrow$ press `Enter` $\rightarrow$ verify `onAnswer` fired with mode `'custom_text'`.

### 4.2 `CriticReviewDrawer.test.tsx`
- **Test 1: Severity Tab Filtering**:
  - Provide 1 critical finding and 2 suggestions.
  - Click `Critical` tab $\rightarrow$ assert only 1 card is visible.
  - Click `Suggestions` tab $\rightarrow$ assert 2 cards are visible.
- **Test 2: 1-Click Fix Application**:
  - Click `[✨ Apply Fix]` on Finding #1 $\rightarrow$ assert `onApplyFix` is called with finding payload and button shows loading $\rightarrow$ checkmark state.
- **Test 3: Finding Dismissal & Collapse**:
  - Click `[✕ Dismiss]` on Finding #2 $\rightarrow$ assert `onDismissFinding` is called and card smoothly collapses.

---

## 5. Coverage Targets & Stage Gate Handoff

- **Target Coverage**: $\ge 90\%$ branch coverage across `node-backend/lib/critics/`, `node-backend/lib/socratic/`, and workspace critic components.
- **Artifacts Produced**: `docs/features/socratic-pm-harness/unit-test-plan.md`
- **Handoff to Next Agent**: **E2E Test Agent** (for `e2e-plan.md`)
- **Blockers**: None.
