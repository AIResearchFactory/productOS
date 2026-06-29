# Next Steps & Roadmap - Silent Learner Mode

This document outlines the planned future enhancements and post-MVP phases for the **Silent Learner Mode** feature in ProductOS.

---

## Phase 2: Interactive Lesson Review UI

- **Lesson Inspector**: Implement a dedicated interactive panel within Product Settings that allows users to review, edit, or delete individual distilled lessons and co-occurrence graphs.
- **Rule Adjustments**: Enable users to manually flag lessons as high/low signal or create custom rule overrides.

---

## Phase 3: Semantic Retrieval & Embeddings

- **Vector Database**: Integrate a lightweight, local vector index (such as `sqlite-vec`, LanceDB, or local Chroma instances) to replace simple regex/keyword task alignment.
- **Advanced Summarization**: Trigger on-demand summarization via local Ollama models when active context documents exceed prompt token budgets (e.g., >2,000 tokens).

---

## Phase 4: LoRA / QLoRA Adapter Training

- **Local Fine-Tuning**: Provide an advanced opt-in setting to trigger lightweight LoRA or QLoRA fine-tuning workflows on consumer hardware (such as Apple Silicon or discrete GPUs).
- **Project Adapters**: Maintain project-specific adapters that can be dynamically loaded and swapped into the base Ollama model.

---

## Phase 5: Team Shared Learning

- **Knowledge Syncing**: Establish policy-controlled, peer-to-peer or cloud-hosted syncing of distilled memory packs across development and product teams.
- **Safety Checks**: Introduce model-assisted audit sweeps to ensure shared team packs do not leak proprietary credentials or customer identifiers.
