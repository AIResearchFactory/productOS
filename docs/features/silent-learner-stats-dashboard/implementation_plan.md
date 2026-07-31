# Implementation Plan: Silent Learner Stats & Value Dashboard

**Feature Name:** Silent Learner Stats & Value Dashboard  
**Target Path:** `docs/features/silent-learner-stats-dashboard/implementation_plan.md`  
**Status:** Saved for Future Implementation  
**Execution Phase:** Post-MVP Enhancement

---

## 1. Goal Description

Enhance the Silent Learner settings view (`SilentLearnerSettings.tsx`) with a high-impact **Value & ROI Dashboard** that quantifies the benefits of Silent Learner background context distillation.

Key outcomes:
- Display estimated tokens saved and API cost reduction using an explicit, transparent fixed benchmark.
- Present prompt latency improvements and AI solution acceptance rates.
- Provide a clear Privacy & Redaction Shield counter demonstrating local safety.
- Prepare backend API endpoints for Sprint 2's read-only Lesson Inspector (with boost/mute feedback toggles).

---

## 2. Proposed Changes

### Component 1: Backend API & Aggregation Services (`node-backend/`)

#### [MODIFY] [learning-store.mjs](file:///Users/assafmiron/Documents/Code/ai-researcher/node-backend/lib/silent-learner/learning-store.mjs)
- Add `getMetricsSummary(projectId)` function to aggregate:
  - Total observed sessions count
  - Total qualifying events count
  - Total accepted solutions count (`accepted_changes = 1`)
  - Total redactions logged from `redaction_logs` table
  - Calculated estimated tokens saved (`qualifyingEvents * 2600`)
  - Calculated cost saved (`estimatedTokensSaved * 0.000003`)
  - Calculated acceptance rate (`acceptedEvents / totalEvents`)

#### [MODIFY] [server.mjs](file:///Users/assafmiron/Documents/Code/ai-researcher/node-backend/server.mjs)
- Add REST endpoint `GET /api/projects/:id/silent-learner/metrics` returning the aggregated ROI metrics object.
- Add REST endpoint `GET /api/projects/:id/silent-learner/memory-packs/:packId/lessons` (Sprint 2).
- Add REST endpoint `POST /api/projects/:id/silent-learner/lessons/:lessonId/feedback` (Sprint 2).

---

### Component 2: Frontend API Contracts & Services (`src/api/`)

#### [MODIFY] [contracts.ts](file:///Users/assafmiron/Documents/Code/ai-researcher/src/api/contracts.ts)
- Define `SilentLearnerMetrics` interface:
  ```ts
  export interface SilentLearnerMetrics {
    workspaceId: string;
    sessionsObserved: number;
    qualifyingEvents: number;
    acceptedEvents: number;
    acceptanceRate: number;
    estimatedTokensSaved: number;
    estimatedCostSavedUsd: number;
    estimatedLatencyReductionPct: number;
    redactionCount: number;
    benchmark: {
      tokensSavedPerTurn: number;
      costPerKTokensUsd: number;
    };
  }
  ```

#### [MODIFY] [server.ts](file:///Users/assafmiron/Documents/Code/ai-researcher/src/api/server.ts)
- Add `getMetrics(projectId: string): Promise<SilentLearnerMetrics>` method to `silentLearnerApi`.

---

### Component 3: Frontend Settings UI (`src/components/settings/`)

#### [MODIFY] [SilentLearnerSettings.tsx](file:///Users/assafmiron/Documents/Code/ai-researcher/src/components/settings/SilentLearnerSettings.tsx)
- Import Lucide icons: `Coins`, `Clock`, `ShieldCheck`, `TrendingUp`, `Info`.
- Import shadcn Tooltip component components (`Tooltip`, `TooltipContent`, `TooltipProvider`, `TooltipTrigger`).
- Replace existing 3 basic stats cards with an expanded **ROI & Impact Summary Grid**:
  1. **Tokens Saved & Financial Impact Card** with Info icon & methodology tooltip.
  2. **Prompt Latency Boost Card**.
  3. **Solution Acceptance Rate Card**.
  4. **Memory Pack Count Card**.
- Add **Privacy & Security Intercept Shield Card** highlighting local redaction count.

---

## 3. Verification Plan

### Automated Tests
- **Backend Metric Aggregation Unit Tests (`node-backend/tests/silent-learner/metrics.test.mjs`):**
  - Verify `getMetricsSummary(projectId)` calculates token savings based on `qualifyingEvents * 2600`.
  - Verify acceptance rate calculation handles division by zero when events = 0.
  - Verify redaction count accurately reflects rows in `redaction_logs`.
- **E2E Playwright Tests (`e2e/silent-learner-dashboard.spec.ts`):**
  - Verify ROI cards render on the settings page.
  - Verify hovering over the benchmark Info icon displays the tooltip content.
  - Verify toggling Silent Learner off preserves historical metrics display.

### Manual Verification
1. Navigate to Project Settings → Silent Learner.
2. Verify stats cards display correctly formatted values (e.g. `145.2K` tokens, `~$0.43` cost saved).
3. Hover over the info icon to check tooltip positioning and dark mode styling.
4. Verify redaction counter updates dynamically when sensitive inputs are redacted.
