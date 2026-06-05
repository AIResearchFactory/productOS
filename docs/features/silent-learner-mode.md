# Silent Learner Mode Architecture

Silent Learner Mode is a privacy-first ProductOS capability that learns from a user's successful work with AI vendors and local tools, then turns those signals into reusable local memory, training-ready examples, and optional lightweight model adapters.

The default path should **not** continuously fine-tune a model. It should use low-resource memory, retrieval, and example distillation first, with adapter training as an explicit advanced option.

## Goals

- Learn from productive interactions with any supported AI vendor or local model.
- Preserve user and workspace privacy by default.
- Improve ProductOS assistance using local memory and retrieval before expensive training.
- Support small Ollama-hosted models such as Gemma, Qwen, DeepSeek Coder, Phi, or SWE-oriented models.
- Allow encrypted backup and restore of learned artifacts.
- Make every learned artifact inspectable, deletable, and auditable.

## Non-goals

- No hidden cloud upload of raw transcripts.
- No always-on full model fine-tuning.
- No training on secrets, credentials, private messages, or excluded project data.
- No assumption that the user has a high-end GPU.

## Operating Modes

| Mode | Behavior |
| --- | --- |
| Off | No capture or learning. |
| Observe Only | Capture metadata and quality signals, but do not build reusable memory. |
| Local Learn | Redact, summarize, and store local memory/examples. Recommended default opt-in mode. |
| Local Learn + Encrypted Backup | Same as Local Learn, with encrypted backup of approved artifacts. |
| Adapter Training | Optional LoRA/QLoRA training when hardware and consent allow it. |
| Team Shared Learn | Future mode for policy-controlled team knowledge sharing. |

## High-level Architecture

```text
Vendor AI Tools / Local Models / ProductOS Agents
    ↓
Interaction Capture Layer
    ↓
Privacy, Policy, and Secret Redaction
    ↓
Learning Event Store
    ↓
Signal Extractor and Quality Scorer
    ↓
Memory Pack + Example Builder
    ↓
Local Retrieval Layer
    ↓
Ollama Local Assistant
    ↓
Optional Adapter Training
    ↓
Encrypted Backup / Restore
```

## Core Components

### 1. Interaction Capture Layer

Captures structured traces from supported surfaces:

- ProductOS-native AI chats.
- Vendor API calls.
- CLI coding agents.
- IDE or editor integrations.
- Browser-based AI sessions where supported and consented.
- File diffs, test results, and user accept/reject signals.

Example event:

```json
{
  "source": "vendor-ai",
  "workspaceId": "productos-main",
  "taskType": "bugfix",
  "promptHash": "sha256:...",
  "responseHash": "sha256:...",
  "acceptedChanges": true,
  "filesTouched": ["src/workflows/editor.tsx"],
  "outcome": "tests_passed",
  "timestamp": "2026-06-05T19:00:00Z"
}
```

Raw prompt/response capture should be separately controlled by policy. The system can learn useful signals without preserving full transcripts.

### 2. Privacy and Consent Filter

Before any event becomes learning material, ProductOS classifies and redacts it.

Required protections:

- Secret scanning using deterministic rules and model-assisted classification.
- Per-workspace opt-in/out.
- Exclusion rules for files, paths, vendors, chats, and data classes.
- “Forget last session”, “forget last hour”, and “forget this workspace” actions.
- Local-only mode.
- Encrypted backup only after explicit configuration.

Data classes:

```text
safe
sensitive
secret
personal
vendor-confidential
excluded
```

### 3. Learning Event Store

A local append-only store for learning traces and derived artifacts.

Recommended MVP storage:

- SQLite for metadata and job state.
- JSONL for examples and preference pairs.
- `sqlite-vec`, LanceDB, or Chroma for embeddings.
- Encrypted local object store for approved artifacts.

Suggested tables:

```text
learning_events
redaction_logs
training_examples
memory_packs
model_versions
distillation_jobs
backup_snapshots
```

### 4. Signal Extractor and Quality Scorer

Turns noisy activity into useful learning signals.

High-signal examples include:

- User accepted the output.
- Tests passed after the change.
- PR merged or task completed.
- User corrected the AI and the correction worked.
- The same workflow repeated multiple times.
- The solution was not reverted.

Low-signal examples should be discarded or kept only as metadata.

### 5. Memory Pack Builder

The main low-resource learning output should be memory packs, not trained weights.

Examples:

```text
workspace-style.md
testing-patterns.md
architecture-notes.md
accepted-solutions.jsonl
rejected-patterns.jsonl
vendor-lessons.jsonl
tool-recipes.jsonl
```

These artifacts are retrieved at runtime and injected into prompts for local or vendor models.

### 6. Local Retrieval Layer

Uses embeddings and metadata filters to retrieve relevant memory.

Runtime flow:

```text
User task
  ↓
Classify task and workspace context
  ↓
Retrieve relevant memory packs, examples, and tool recipes
  ↓
Build compact context window
  ↓
Call Ollama model or selected vendor
```

This gives a personalized model experience without model training.

### 7. Ollama Runtime

Ollama provides local model serving.

Recommended model roles:

| Role | Purpose | Model size |
| --- | --- | --- |
| Observer | Classify whether an event is useful. | Tiny / 1B-3B |
| Redactor | Assist secret and PII filtering. | Tiny / 1B-3B plus deterministic scanner |
| Summarizer | Convert long sessions into compact examples. | 1.5B-7B |
| Critic | Score examples before storing/training. | 1.5B-7B |
| Local Assistant | User-facing local assistant. | 3B-14B depending on hardware |
| Embedding Model | Retrieval indexing. | Small embedding model |

Candidate Ollama models:

- `qwen2.5-coder:1.5b`, `qwen2.5-coder:7b`
- `gemma2:2b`, `gemma2:9b`
- `deepseek-coder:1.3b`, `deepseek-coder:6.7b`
- `phi3:mini`
- future SWE-oriented small coding models

## Resource Reduction Strategy

Silent Learner Mode should avoid expensive model training by default.

### Default: RAG + memory, no training

```text
Capture → Redact → Summarize → Store memory/examples → Retrieve at runtime
```

Benefits:

- CPU-friendly.
- Works on normal laptops.
- Fast to update.
- Easy to inspect and delete.
- Easy to back up.

### Optional: LoRA/QLoRA adapters

When the user has enough hardware and explicitly opts in, ProductOS can train small adapters instead of full models.

Benefits:

- Much smaller than full model fine-tuning.
- One adapter per user/workspace.
- Easy backup and rollback.
- Base model remains unchanged.

### Avoid full fine-tuning by default

Full fine-tuning should be treated as an advanced, external, or cloud-assisted workflow. It should not be part of the MVP.

## Local Setup Requirements

### MVP / Low-resource setup

For RAG + memory + local inference:

- Ollama installed or managed by ProductOS.
- One small local model.
- 8-16GB RAM.
- 5-20GB disk.
- CPU-only acceptable.
- SQLite.
- Local vector index.
- Secret redactor.
- ProductOS background worker.

### Recommended developer setup

- 16-32GB RAM.
- Optional NVIDIA GPU with 8GB+ VRAM.
- 50-100GB disk.
- 3B-7B local coding model.
- Local embeddings model.
- Encrypted backup target.

### Advanced adapter-training setup

- 32-64GB RAM.
- NVIDIA GPU with 12-24GB+ VRAM.
- 100-300GB disk.
- CUDA-capable Python environment.
- LoRA tooling such as Unsloth, Axolotl, PEFT, or llama.cpp export tools.

## Distillation Pipeline

The word “distillation” in the MVP should mean converting work into compact reusable knowledge, not necessarily model-weight training.

```text
Capture
  ↓
Redact
  ↓
Score
  ↓
Summarize
  ↓
Deduplicate
  ↓
Build memory packs and JSONL examples
  ↓
Evaluate retrieval usefulness
  ↓
Optionally train adapter
```

Training-ready example:

```json
{
  "instruction": "Fix a flaky Playwright test caused by a transient running-state button.",
  "context": "Workflow runs may complete before the stop button is visible.",
  "preferred_solution": "Accept either the stop button or another valid running-state signal.",
  "rejected_solution": "Assert only on the stop button.",
  "tags": ["playwright", "e2e", "workflow", "testing"]
}
```

Preference pair:

```json
{
  "prompt": "Improve this workflow test assertion.",
  "chosen": "Use a resilient assertion that accepts multiple valid running/completed states.",
  "rejected": "Wait only for a transient stop button."
}
```

Tool trace:

```json
{
  "task": "Fix failing E2E test",
  "steps": [
    "inspect failure output",
    "identify transient UI state",
    "update selector logic",
    "run focused test"
  ],
  "result": "passed"
}
```

## Backup and Restore

Backups should be encrypted and artifact-oriented.

Backup contents:

```text
model manifest
memory packs
training-ready JSONL examples
retrieval indexes
LoRA adapters, if any
evaluation results
redaction audit logs
```

Avoid backing up raw transcripts by default.

Example manifest:

```json
{
  "feature": "silent-learner",
  "workspaceId": "productos-main",
  "baseModel": "qwen2.5-coder:7b",
  "adapterVersion": null,
  "memoryPackVersion": "v12",
  "createdAt": "2026-06-05T19:00:00Z",
  "datasetHash": "sha256:...",
  "encrypted": true,
  "rawTranscriptsIncluded": false
}
```

## Product UX

The first UX milestone is a privacy-safe in-app notification when Silent Learner becomes useful for a workspace. See [Silent Learner UX Notifications MVP](./silent-learner-mode-ux-notifications.md) for the event contract, copy, notification rules, and acceptance criteria.

Dashboard states:

```text
Silent Learner: Off
Silent Learner: Observing
Silent Learner: Learning Locally
Silent Learner: Memory Ready
Silent Learner: Backup Synced
Silent Learner: Adapter Training Available
```

Useful controls:

- Pause learning.
- Forget last hour.
- Forget this session.
- Forget this workspace.
- Review learned examples.
- Export memory pack.
- Backup now.
- Restore backup.
- Enable adapter training.
- Disable cloud sync.

Privacy indicators should be visible and plain-language, not buried in settings.

## MVP Recommendation

Build Silent Learner Mode in this order:

1. Ready-state UX notification contract and copy.
2. ProductOS-native interaction capture.
3. Local SQLite learning event store.
4. Deterministic secret scanner and redaction logs.
5. Memory pack builder.
6. Local embedding and retrieval index.
7. Ollama local assistant integration.
8. Manual “distill now” action.
9. Encrypted backup/restore for memory packs.
10. Example review UI.
11. Optional LoRA adapter training as a later advanced feature.

MVP success should be measured by whether ProductOS retrieves useful prior patterns and improves assistance without requiring GPU training.

## Open Questions

- Which vendor surfaces should be supported first beyond ProductOS-native AI sessions?
- Should raw transcript capture be entirely disabled by default, or allowed for local-only users?
- Which embedding model should be bundled or recommended?
- Should backup use ProductOS Cloud first, or pluggable S3-compatible storage?
- What policy model is needed before team-shared learning?
