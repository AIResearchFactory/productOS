# Backend Implementation Plan: Socratic PM Intelligence (M1)

> **Feature**: `socratic-pm-harness`  
> **Milestone**: M1 (P0: Socratic Grilling Engine + On-Demand Critic Board)  
> **Pipeline Stage**: Backend Agent $\rightarrow$ Ready for Implementation & Test  
> **Reference Specs**: [prd.md](./prd.md) &bull; [ux-spec.md](./ux-spec.md) &bull; [frontend-plan.md](./frontend-plan.md)

---

## 1. Executive Summary & Architecture Overview

This plan defines the Node.js backend implementation for **Milestone 1 (P0)** of Socratic PM Intelligence.
It introduces two new service modules and enhances the chat/prompting pipeline:
1. **Adversarial Critic Service (`node-backend/lib/critics/index.mjs`)**: Orchestrates parallel mini-agent audits (*The Devil's PM*, *The Telemetry Guardian*, *The Tone & Brand Inspector*) leveraging the project's OKF context.
2. **Socratic Interrogator Engine (`node-backend/lib/socratic/index.mjs`)**: Identifies high-stakes artifact intent, formulates context-aware questions, and injects user clarifications or best-practice assumptions into the prompt pipeline.
3. **Silent Learner Bridge (`node-backend/lib/silent-learner/learning-store.mjs`)**: Ingests user decisions from Socratic answers and calibrates critic sensitivity when findings are accepted or dismissed.

---

## 2. File Inventory & Module Structure

```
node-backend/
├── lib/
│   ├── critics/
│   │   ├── index.mjs                    [NEW] Orchestrator for parallel critic audits
│   │   ├── devils-pm.mjs                [NEW] Mini-agent prompt & parser for scope/edge cases
│   │   ├── telemetry-guardian.mjs       [NEW] Mini-agent prompt & parser for KPIs/events
│   │   └── tone-inspector.mjs           [NEW] Mini-agent prompt & parser for style/keywords
│   ├── socratic/
│   │   ├── index.mjs                    [NEW] Socratic intent detector & question synthesizer
│   │   └── prompts.mjs                  [NEW] Socratic clarification prompt templates
│   ├── silent-learner/
│   │   └── learning-store.mjs           [MODIFY] Add recordCriticFeedback & recordSocraticDecision
│   └── context/
│       └── okf-loader.mjs               [MODIFY] Provide cached project context for critics
├── server.mjs                           [MODIFY] Register /api/artifacts/audit & /api/learning/feedback routes
└── tests/
    ├── critics/
    │   └── critic-service.test.mjs      [NEW] Unit & integration tests for Critic Board
    └── socratic/
        └── socratic-service.test.mjs    [NEW] Unit tests for Socratic question synthesis
```

---

## 3. API Route Specifications (`server.mjs`)

### 3.1 Route 1: Artifact Adversarial Audit
- **Endpoint**: `POST /api/artifacts/audit`
- **Controller**: `handleArtifactAudit(req, res)`
- **Request Validation**:
  - `projectId`: String (must be valid existing project ID).
  - `artifactPath`: String (sanitized against path traversal via `path.resolve`).
  - `content`: String (required, min length 20 characters).
  - `critics`: Array of `'devils_pm' | 'telemetry_guardian' | 'tone_inspector'` (optional, defaults to all 3).
- **Execution Flow**:
  1. Load project OKF context via `loadProjectContext(projectId)` (`settings.json`, `references/keywords.md`, `references/avoided-terms.md`).
  2. Execute mini-agents concurrently using `Promise.allSettled()`:
     ```javascript
     const [devilsResult, telemetryResult, toneResult] = await Promise.allSettled([
       runDevilsPMCritic(content, context),
       runTelemetryCritic(content, context),
       runToneInspectorCritic(content, context),
     ]);
     ```
  3. Aggregate findings, compute `overallScore` (100 - penalties), and return formatted JSON response.
- **Success Response (200 OK)**:
  ```json
  {
    "summary": "Audited with 3 critics. 1 critical issue, 2 suggestions.",
    "overallScore": 84,
    "findings": [
      {
        "id": "crit-001",
        "critic": "devils_pm",
        "severity": "critical",
        "title": "Missing Rate Limit & Dead-Letter Queue",
        "description": "The spec does not handle HTTP 429 webhook backoff.",
        "quote": "Slack alerts are pushed immediately upon event occurrence.",
        "suggestedFix": "Add Section 3.4: 'Retry with exponential backoff up to 3 times; route failed deliveries to dead-letter queue.'",
        "targetSection": "3. Functional Requirements"
      }
    ]
  }
  ```
- **Error Response (400 / 500)**:
  - `400 Bad Request`: `{"error": "Missing required field: content"}`
  - `404 Not Found`: `{"error": "Project not found"}`
  - `500 Internal Error`: `{"error": "Critic evaluation failed", "details": "..."}`

---

### 3.2 Route 2: Silent Learner Feedback Ingestion
- **Endpoint**: `POST /api/learning/feedback`
- **Controller**: `handleLearningFeedback(req, res)`
- **Request Body**:
  ```json
  {
    "projectId": "proj-analytics-platform",
    "feedbackType": "critic_resolution",
    "data": {
      "findingId": "crit-001",
      "action": "applied",
      "critic": "devils_pm",
      "learnedRule": "Always require dead-letter queue specifications for webhook architectures."
    }
  }
  ```
- **Execution Flow**:
  1. Validates payload structure.
  2. Persists learned rule to project memory pack in `learning-store.mjs`.
  3. Updates `.metadata/_context/learned-preferences.md` for subsequent generation passes.
  4. Returns `{"success": true, "updatedRulesCount": 4}`.

---

## 4. Mini-Agent Evaluator Prompts & Logic

### 4.1 The Devil's PM Mini-Agent (`node-backend/lib/critics/devils-pm.mjs`)
- **System Role**: *"You are an adversarial, hyper-rigorous Principal Product Manager. Your job is to tear down draft specs to find unstated assumptions, missing edge cases, negative flows, concurrency traps, and scope creep."*
- **Output Schema Enforcement**: Enforces deterministic JSON structure with `title`, `description`, `quote`, `suggestedFix`, and `targetSection`.

### 4.2 The Telemetry & Metrics Guardian (`node-backend/lib/critics/telemetry-guardian.mjs`)
- **System Role**: *"You are a Staff Product Analytics Lead. Your job is to ensure every feature is 100% instrumented with primary KPIs, guardrail metrics, PostHog/Segment tracking events, error rates, and rollback triggers."*

### 4.3 The Tone & Brand Inspector (`node-backend/lib/critics/tone-inspector.mjs`)
- **System Role**: *"You are a Brand Voice & Nomenclature Auditor. You cross-reference text against forbidden terms and domain keywords from project context, stripping out marketing hyperbole and AI clichés."*

---

## 5. Performance, Concurrency & Error Handling

1. **Parallel Execution**: Mini-agents execute concurrently using `Promise.allSettled()`. If one critic times out (e.g. 8s timeout), the remaining critics' findings are still returned.
2. **Context Caching**: Project context and keyword lists are read once per audit session from memory cache rather than re-reading disk multiple times.
3. **Provider Fallback**: If structured JSON parsing fails from an LLM response, a regex fallback extracts findings blocks cleanly without throwing 500 errors.

---

## 6. Backward Compatibility & Observability

- **Zero Breaking Changes**: Existing `/api/chat` streaming endpoints and `/api/projects` routes are completely untouched.
- **Trace Logging**: Every audit execution emits structured trace logs:
  `[AUDIT] Project: proj-123 | Critics: 3 | ExecutionTime: 1840ms | Findings: 3 (1 critical)`.

---

## 7. Stage Gate Handoff Contract (BE $\rightarrow$ QA Strategy)

### Summary
Backend implementation plan delivered for Milestone 1 (P0), detailing endpoint schemas, mini-agent prompts, concurrency handling, error fallbacks, and Silent Learner persistence.

### Decisions Made
1. Mini-agents run concurrently via `Promise.allSettled()` with an 8-second circuit breaker.
2. Results normalize to a uniform `CriticFinding[]` schema with quotes and suggested replacement text.
3. Feedback ingestion updates both `.metadata/_context/` and `learning-store.mjs`.

### Artifacts Produced
- `docs/features/socratic-pm-harness/backend-plan.md`

### Handoff to Next Agent
- **QA Strategy Agent**: Ready to generate the risk-based test matrix and test plans in `docs/features/socratic-pm-harness/qa-plan.md`.

### Blockers
- None. Ready for QA Strategy.
