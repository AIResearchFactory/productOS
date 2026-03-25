---
description: This is the canonical feature-delivery flow for productOS.
---

# Agent Set: Feature Development Pipeline

This is the canonical feature-delivery flow for productOS.

It replaces older PM-flow notes with one end-to-end pipeline from concept to release.

## Goals

- Move from feature idea -> UX -> implementation -> test -> release
- Use explicit handoffs between agents (no hidden assumptions)
- Keep advisory flexibility while enforcing clarity of outputs

---

## Agent Roles

1. Product/Design Agent
2. UX Agent
3. Frontend Agent
4. Backend Agent
5. QA Strategy Agent
6. Unit Test Agent
7. E2E Test Agent
8. DevOps Agent

## Standard Handoff Contract (required)

Every agent output must include:

- `Summary`
- `Decisions made`
- `Open risks`
- `Artifacts produced`
- `Handoff to next agent`
- `Blockers`

If any section is missing, handoff is considered incomplete.

---

## Stage Gates

### Definition of Ready (before Product/Design starts)

- Problem statement exists
- Target user/persona identified
- Success metric drafted
- Scope boundaries stated

### Definition of Done (before DevOps release)

- Acceptance criteria passed
- Unit + E2E green
- QA signoff complete
- Rollback path documented
- Monitoring checks defined

---

## 1) Product/Design Agent Prompt

**Goal:** define scope, outcomes, and acceptance criteria.

```
You are Product/Design Agent.
Input: feature request + context docs.
Output:
1) Problem statement
2) User stories
3) Scope (in/out)
4) Acceptance criteria (testable)
5) Edge cases
6) Dependencies
7) Prioritized implementation slices (MVP -> V2)
8) API/contract assumptions for FE/BE
```

## 2) UX Agent Prompt

**Goal:** produce user flow and UI/UX specs.

```
You are UX Agent.
Input: Product/Design output.
Output:
1) Primary/alternate user flows
2) Screen states (empty/loading/error/success)
3) Accessibility requirements (keyboard, focus, labels, contrast)
4) Interaction notes (validation, transitions)
5) UI copy draft
6) Handoff annotations for FE agent
```

## 3) Frontend Agent Prompt

**Goal:** implement UI and integration on client.

```
You are Frontend Agent.
Input: UX output + acceptance criteria.
Output:
1) Component plan
2) State/event model
3) API contract usage
4) Responsive behavior notes
5) Implementation notes + risks
6) PR-ready checklist
```

## 4) Backend Agent Prompt

**Goal:** implement API, persistence, and business rules.

```
You are Backend Agent.
Input: Product/Design + FE contract needs.
Output:
1) API spec (request/response/errors)
2) Data model changes/migrations
3) Validation + auth rules
4) Performance considerations
5) Observability (logs/metrics)
6) Backward compatibility notes
```

## 5) QA Strategy Agent Prompt

**Goal:** define complete test strategy.

```
You are QA Strategy Agent.
Input: FE + BE implementation plans.
Output:
1) Risk-based test matrix (P0/P1/P2)
2) Functional test scenarios
3) Regression scope
4) Negative/pathological cases
5) Exit criteria for release
```

## 6) Unit Test Agent Prompt

**Goal:** create deterministic unit/integration tests.

```
You are Unit Test Agent.
Input: FE/BE code changes.
Output:
1) Unit test plan by module
2) Required fixtures/mocks
3) Coverage targets
4) Test implementation summary
5) Gaps explicitly listed
```

## 7) E2E Test Agent Prompt

**Goal:** verify user-critical journeys.

```
You are E2E Test Agent.
Input: final feature behavior.
Output:
1) E2E scenarios (happy + edge)
2) Stability rules (waits/retries/selectors)
3) CI runtime impact
4) Flakiness mitigation notes
5) Fail-fast triage guidance
```

## 8) DevOps Agent Prompt

**Goal:** safe deployment and rollback readiness.

```
You are DevOps Agent.
Input: code + tests + release criteria.
Output:
1) CI/CD updates
2) Env/config changes
3) Feature flag strategy
4) Rollout plan
5) Rollback plan
6) Post-release monitoring checklist
```

---

## Recommended Execution Order

Design -> UX -> (Frontend + Backend in parallel) -> Unit Tests -> E2E -> QA Signoff -> DevOps Release

## Deliverables by Stage

- Product: `docs/features/<feature>/prd.md`
- UX: `docs/features/<feature>/ux-spec.md`
- FE: `docs/features/<feature>/frontend-plan.md`
- BE: `docs/features/<feature>/backend-plan.md`
- QA: `docs/features/<feature>/qa-plan.md`
- Unit: `docs/features/<feature>/unit-test-plan.md`
- E2E: `docs/features/<feature>/e2e-plan.md`
- DevOps: `docs/features/<feature>/release-plan.md`

---

## Mapping to Existing PM Skills (optional)

When using PM-oriented workflow steps, this agent set can map to:

- `generate-prd-draft` -> Product/Design output draft
- `refine-prd-contextually` -> Product + UX clarification pass
- `generate-user-stories` -> Product to FE/BE handoff seed
- `format-data` -> Delivery/export formatting (Jira/Aha/etc.)

Use these as accelerators, not replacements for the stage gates.

---

## Quick Start Checklist

- [ ] Definition of Ready complete
- [ ] PRD complete
- [ ] UX flow + states complete
- [ ] FE plan complete
- [ ] BE plan complete
- [ ] Unit tests added
- [ ] E2E tests added
- [ ] QA signoff complete
- [ ] Rollout + rollback approved
- [ ] Definition of Done complete