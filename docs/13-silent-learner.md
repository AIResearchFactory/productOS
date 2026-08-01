# Silent Learner Mode: Local-First Memory & Context Optimization

[← Previous: Integrations Guide](12-integrations-guide.md) | [Back to Documentation Home](README.md)

---

## Overview

**Silent Learner Mode** is a privacy-first, local-first capability in ProductOS. It monitors successful interactions with AI agents and tools, extracting useful context, development patterns, and file usage. This metadata is distilled into compact local memory packs and semantic indices that augment the AI's prompt context on subsequent turns.

By substituting bloated raw workspace files with highly focused local memory and summarized context outlines, Silent Learner Mode achieves a **$\ge 60\%$ reduction in token overhead**, keeping prompts fast, highly relevant, and extremely cost-effective.

---

## Core Pillars & Architecture

Silent Learner is structured around three core pillars: **Privacy by Default**, **Multi-Signal Context Optimization**, and **Tiered Embedding Retrieval**.

```text
AI Interaction Traces
        ↓
Interaction Capture (Capture Hook)
        ↓
Deterministic Secret & PII Scanner (Privacy Filter)
        ↓
Local SQLite DB (.metadata/memory.db)
        ↓
Context Rescoring Engine (Multi-Signal Scoring)
        ↓
Tiered Vector Index (Active Provider → Local Ollama → JS TF Cosine Similarity)
        ↓
Advanced Summarization Caching (>2000 tokens)
        ↓
Prompt Context Injection
```

### 1. Privacy & Consent (Secret Scanner)
Before any transaction logs are used for learning:
- **Secret Redaction**: A local deterministic scanner parses prompts and replies for credentials, API tokens, email addresses, and keys, redacting them immediately.
- **Auto-Pause**: If a secret is identified in a conversation, Silent Learner immediately logs the event as redacted and **pauses** learning for that project.
- **Granular Controls**: Users can pause learning, run project-specific scans, or wipe history completely via "Forget last session" or "Forget workspace" actions. All data is isolated in the project's local `.metadata/memory.db` file.

### 2. Multi-Signal Context Optimization
To prevent context window clutter, ProductOS scores potential prompt files dynamically:
$$S = (w_{\text{explicit}} \cdot C + w_{\text{usage}} \cdot U + w_{\text{recency}} \cdot R + w_{\text{alignment}} \cdot A) \times M_{\text{type}} \times M_{\text{active}}$$

- **Explicit Confidence ($C$)**: User-defined relevance values.
- **Usage Consistency ($U$)**: Normalized access frequency.
- **Recency Decay ($R$)**: Modeled as $e^{-\lambda t}$ to degrade stale resources.
- **Task Alignment ($A$)**: Semantic cosine similarity to the current task goal.
- **Active State Modifier ($M_{\text{active}}$)**: Temporary boosts (e.g., $+0.5$ for unstaged git changes, $+0.8$ for compiling/test failures).

Files scoring $S \ge 0.7$ enter the **Active Context** and are injected directly.

### 3. Three-Tiered Semantic Alignment
To keep ProductOS fully portable, task alignment uses a three-tiered approach:
1. **Tier 1: Active API Provider**: If using a programmatic provider (e.g. OpenAI or Hosted API), embeddings are requested through their API.
2. **Tier 2: Local Ollama**: If the active provider is a CLI tool but local Ollama is running, we query local Ollama embeddings (`nomic-embed-text`).
3. **Tier 3: Pure JS Term Frequency (TF) Cosine Similarity**: If offline or no embedding API is available, a pure JS term-frequency vectorizer maps and compares cosine similarity locally in under 2ms.

---

## Advanced Summarization Caching

When a file enters the active context but exceeds a local token threshold of **2,000 tokens (approx. 8,000 characters)**, ProductOS triggers **Advanced Summarization**:

- **On-Demand Summary**: ProductOS queries the user's active AI provider to generate a structured outline/summary of the file.
- **Deduplication Cache**: The summary is hashed and stored inside `.metadata/memory.db`. If the file remains unchanged, the cached summary is reused on all subsequent turns, avoiding repeat calls.
- **Fast JS Truncation Fallback**: If the provider API is offline or fails, a pure JS fallback dynamically keeps the first 50 lines and last 50 lines of the file, inserting a truncated context block instead of the massive raw file.

---

## Configuration & Project Exclusions

### Active Statuses & Modes
- **Off**: Silent Learner is deactivated.
- **Observing** (Active/Learning State): Passive monitoring is enabled. Silent Learner captures learning events and file usage statistics locally in `memory.db`.
- **Memory Ready**: Local distillation is complete. Distilled memory packs and task alignment vectors are active and injected into the AI system prompts.
- **Paused**: Learning is temporarily suspended (for example, if the secret scanner detects and redacts private credentials).

* **How to Pause**: Toggling the switch "Off" acts as a manual pause. It suspends event capture while preserving all previously stored files, database weights, and summaries.
* **Transition to Memory Ready**: Distillation is triggered manually by clicking the **"Optimize Memory"** button. If at least 3 qualifying lessons are compiled, the workspace immediately transitions to the **"Memory Ready"** state.

---

## Business & Technical Benefits

- **Token Cost Reduction**: Replaces full document transfers with cached summaries, shaving up to 70% off API bills on extensive research scopes.
- **Lower Inference Latency**: Shorter prompts allow cloud and local models to return responses significantly faster (shorter Time-to-First-Token).
- **Reduced Context Distraction**: Feeds clean, high-signal workspace lessons into the system prompt, keeping AI outputs structured and accurate to your project rules.
