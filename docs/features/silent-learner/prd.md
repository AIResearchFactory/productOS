# Product Requirements Document (PRD) - Silent Learner Mode

## 1. Overview & Objectives

Silent Learner Mode is a local-first, privacy-safe observer capability in ProductOS that passively captures metadata and structural conventions from successful AI interactions to optimize active prompt context. 

### Core Objectives:
- **Zero-Config Personalization**: Automatically tailors AI prompts to the user's specific project patterns.
- **Privacy First**: Operates 100% on-device (local-only), scan/redact secrets client-side, and does not upload raw transcripts or code to cloud APIs.
- **Cost & Latency Optimization**: Minimizes active context windows to slash token overhead by up to 60% and improve response speed.

---

## 2. User Stories & Functional Requirements

### Requirement 1: Background Interaction Capture
- **Description**: The system must hook into all AI interactions (chats, CLI coding tasks, editor diffs) to capture metadata (touched files, task categories, success outcomes, timing).
- **Behavior**: Captured events must be safe-hashed for deduplication without storing raw chat text.

### Requirement 2: Privacy Filter & Redaction
- **Description**: Deterministic and model-assisted scanning must redact sensitive identifiers (API keys, passwords, personal data) before data is committed.
- **Forget Controls**: Users must be able to "forget last hour", "forget session", or "forget workspace" to wipe data.

### Requirement 3: Multi-Signal Relevance Scoring
- **Description**: Documents and metadata are scored dynamically using weighted signals:
  - Explicit Confidence ($C$)
  - Usage Consistency ($U$)
  - Recency Decay ($R$)
  - Task Alignment ($A$)
- **Modifiers**: Active Git changes and test failure stack traces apply scoring boosts.

### Requirement 4: Memory Distillation & Local Retrieval
- **Description**: Local background worker compiles events into memory packs (JSONL) and injects highly scored file hints within a token budget.
- **Eviction**: Completing a task in `task.md` triggers dynamic task eviction to prune context.

### Requirement 5: Workspace Settings Integration
- **Description**: Settings and control panels must be integrated directly into each project settings view (Project Settings), ensuring strict workspace isolation.
- **Controls**: Enable/disable switch, cold-start "Optimize Memory" historical scanner, JSONL export, and "Wipe All Data" database destruction options.

---

## 3. Non-Functional Requirements & KPIs

- **CPU & RAM**: Database co-occurrence link mapping and updates must consume $< 1\%$ host CPU and $< 20\text{MB}$ of RAM.
- **Disk Longevity**: Caches and statistics commits must be debounced by 30 seconds.
- **Performance**: Historical chats cold-start optimize scans must complete in $< 5$ seconds for up to 100 files and 50 historical chats.
- **KPI Target**: $\ge 60\%$ average token reduction per turn and $\ge 20\%$ latency improvement for cloud-served models.
