# Architecture Specification - Silent Learner Mode

This document details the high-level components and data pipelines of the **Silent Learner Mode** context optimization engine.

## 1. High-Level Pipeline

```text
Vendor AI Tools / Local Models / ProductOS Agents
    ↓
Interaction Capture Layer (capture-hook.mjs)
    ↓
Privacy, Policy, and Secret Redaction (privacy-filter.mjs)
    ↓
Learning Event Store (learning-store.mjs SQLite DB)
    ↓
Signal Extractor & Memory Scoring Engine (scoring.mjs)
    ↓
Memory Pack & Example Builder (memory-pack.mjs JSONL)
    ↓
Local Retrieval Layer (retrieval.mjs)
    ↓
AI Prompts Context Enrichment
```

---

## 2. Core Modules & Directories

All Silent Learner backend modules reside under `node-backend/lib/silent-learner/`:

- [learning-store.mjs](file:///Users/assafmiron/Documents/Code/ai-researcher/node-backend/lib/silent-learner/learning-store.mjs): Handles local SQLite databases (`memory.db`) inside each project's `.metadata/` directory. Defines schemas for `learning_events`, `file_scores`, and `memory_packs`.
- [privacy-filter.mjs](file:///Users/assafmiron/Documents/Code/ai-researcher/node-backend/lib/silent-learner/privacy-filter.mjs): Scans user prompts and assistant responses for sensitive patterns (API keys, email addresses, database passwords) and redacts them.
- [capture-hook.mjs](file:///Users/assafmiron/Documents/Code/ai-researcher/node-backend/lib/silent-learner/capture-hook.mjs): Hooks into the AI orchestrator to construct provider-agnostic event payloads and classify task types using PM heuristics.
- [scoring.mjs](file:///Users/assafmiron/Documents/Code/ai-researcher/node-backend/lib/silent-learner/scoring.mjs): Calculates the multi-signal relevance score for files and memory packs, applying decay formulas and active state boosts.
- [memory-pack.mjs](file:///Users/assafmiron/Documents/Code/ai-researcher/node-backend/lib/silent-learner/memory-pack.mjs): Distills raw observed events into deduplicated JSONL files (memory packs) under `.metadata/memory-packs/`.
- [retrieval.mjs](file:///Users/assafmiron/Documents/Code/ai-researcher/node-backend/lib/silent-learner/retrieval.mjs): Queries the SQLite event logs and memory packs to compile context blocks matching token budgets.
- [index.mjs](file:///Users/assafmiron/Documents/Code/ai-researcher/node-backend/lib/silent-learner/index.mjs): Implements the main state machine, API router facade, and cold-start optimize scans.
