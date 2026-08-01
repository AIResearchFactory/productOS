# PRD: Silent Learner Knowledge Layer (OKF-Inspired)

## 1. Problem Statement

ProductOS's Silent Learner captures interaction metadata and produces memory packs, but knowledge doesn't compound across sessions. Every new AI session re-derives context from raw files. Users who import their own data face no enrichment — files sit as passive content until the user manually creates artifacts around them.

Meanwhile, emerging patterns (LLM-wiki by Karpathy, Google's Open Knowledge Format) demonstrate that **persistent, LLM-maintained knowledge layers** dramatically improve AI assistance quality by synthesizing, cross-referencing, and maintaining knowledge over time.

**Reference analysis:** [OKF / LLM-Wiki / Silent Learner Analysis](analysis_results.md)

---

## 2. Target User / Persona

- **Product Managers** using ProductOS to manage research, competitive analysis, and product artifacts
- **Researchers** importing large collections of documents and wanting the system to learn from them
- **Teams** building institutional knowledge across projects over time

---

## 3. Success Metrics

| Metric | Target | Measurement |
|---|---|---|
| Token overhead reduction | ≥60% per turn vs unoptimized | Log comparison of prompt sizes |
| Cold-start time for returning users | <2 seconds (down from <5s) | Sidecar + index.md bootstrap timing |
| Zero-friction import | 0 manual steps required before learning begins | User testing: drop files → AI knows about them |
| Knowledge compounding | Knowledge pages auto-created after 3+ related interactions | Count of system-generated knowledge artifacts over time |
| Sidecar coverage | 100% of project files have sidecars within 60s of import | Background worker completion metrics |

---

## 4. User Stories

### US-1: Zero-Friction Data Import
**As a** product manager, **I want to** drop my research files into a project **so that** the system starts learning from them immediately without me adding metadata or restructuring anything.

**Acceptance criteria:**
- Importing any `.md`, `.txt` file generates a sidecar within seconds
- Sidecar contains at minimum: content hash, type classification, title extraction
- Deeper enrichment (summary, tags, entity extraction) runs in background within 60 seconds
- Original files are never modified by the system

### US-2: Progressive Auto-Enrichment
**As a** user, **I want** the system to progressively enrich imported files with metadata **so that** AI sessions get better the longer I use the project.

**Acceptance criteria:**
- Phase 1 (immediate): hash + type classification + title extraction
- Phase 2 (background): summary generation, tag extraction, entity extraction
- Phase 3 (on interaction): cross-reference discovery, co-occurrence links updated
- All enrichment stored in co-located JSON sidecar files

### US-3: Compounding Knowledge Wiki
**As a** researcher, **I want** the system to automatically build knowledge pages about frequently discussed topics **so that** I don't have to re-explain context in every session.

**Acceptance criteria:**
- When an entity/concept appears in 3+ interactions, Silent Learner generates a `knowledge/*.md` page
- Knowledge pages are updated with new information from subsequent interactions
- User can view knowledge pages in the artifacts panel
- Compounding happens silently — no interrupting notifications

### US-4: Knowledge Navigation
**As a** user, **I want** to see a navigable index of all project knowledge **so that** I can understand what the system knows and find gaps.

**Acceptance criteria:**
- `index.md` auto-generated from sidecars, updated on every artifact/sidecar change
- `log.md` records ingest, learn, and lint events chronologically
- Both files are grep-friendly and git-diffable

### US-5: Knowledge Health Checks
**As a** product manager, **I want** the system to flag stale, orphaned, or contradictory knowledge **so that** I can keep my project's knowledge base healthy.

**Acceptance criteria:**
- Lint detects: orphan artifacts, stale content (30+ days), stale sidecars (content hash changed), duplicates (>0.85 similarity)
- Results shown in project settings Knowledge Health panel
- Can be triggered manually or via "Optimize Memory"

---

## 5. Scope

### In scope (MVP)
- OKF-aligned sidecar schema extension
- Progressive auto-enrichment pipeline for imported files
- Auto-generated `index.md` and `log.md`
- Compounding knowledge artifacts (knowledge/, lessons/, syntheses/)
- Knowledge lint/health checks
- Silent Learner as autonomous knowledge maintainer

### Out of scope
- OKF export format (backlogged)
- Custom user-defined artifact types (future)
- Team shared knowledge (Phase 5 of existing roadmap)
- Frontmatter migration (we keep sidecars)
- Vector/embedding-based retrieval (Phase 3 of existing roadmap)

---

## 6. Edge Cases

| Case | Expected Behavior |
|---|---|
| User imports 500+ files at once | Progressive enrichment queues work; Phase 1 sidecars created immediately, Phase 2 runs in batched background worker |
| File modified externally after sidecar generated | Content hash comparison detects change; sidecar marked stale and re-enriched on next access |
| Duplicate files imported | Deduplication lint flags files with >0.85 similarity; system does not auto-delete |
| Silent Learner disabled for project | Sidecars still generated (they're part of artifact infrastructure), but no knowledge pages created and no score updates |
| No AI provider configured | Type classification and title extraction use heuristics (regex-based); summary/entity extraction deferred until provider available |
| Knowledge page contradicts source | Lint flags contradiction; knowledge page includes source citations for user to verify |

---

## 7. Dependencies

- Existing sidecar infrastructure in [artifacts.mjs](node-backend/lib/artifacts.mjs)
- Existing Silent Learner modules in `node-backend/lib/silent-learner/`
- File watcher / SSE events for import detection
- AI provider system for summary/entity extraction (optional — falls back to heuristics)

---

## 8. Implementation Slices

### MVP (Phases 1-2, parallel)
**Phase 1:** OKF-aligned sidecar enrichment + progressive pipeline
**Phase 2:** `index.md` + `log.md` auto-generation

### V2 (Phases 3-4, parallel after MVP)
**Phase 3:** Compounding knowledge artifacts (knowledge/, lessons/, syntheses/)
**Phase 4:** Knowledge lint/health-check operations

### V3 (Phase 5, sequential after V2)
**Phase 5:** Silent Learner as autonomous knowledge maintainer (closed-loop)

---

## 9. API/Contract Assumptions

### Extended Sidecar Schema
```json
{
  "id": "prds/my-feature.md",
  "artifactType": "prd",
  "title": "My Feature",
  "description": "Auto-extracted one-line summary",
  "tags": ["mvp", "mobile"],
  "resource": "prds/my-feature.md",
  "sourceRefs": ["initiatives/mobile-first.md"],
  "citations": [],
  "projectId": "project-123",
  "created": "2026-06-05T19:00:00Z",
  "updated": "2026-06-17T16:00:00Z",
  "silentLearner": {
    "confidence": 0.85,
    "usageConsistency": 0.72,
    "recencyScore": 0.91,
    "taskAlignment": 0.65,
    "compositeScore": 0.81,
    "lastObserved": "2026-06-17T15:00:00Z",
    "relatedConcepts": ["competitor-tool-x", "mobile-ux"],
    "contentHash": "sha256:abc123...",
    "enrichmentLevel": "full",
    "enrichedAt": "2026-06-17T15:30:00Z"
  }
}
```

### New REST API Endpoints
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/projects/:id/enrich` | Trigger enrichment for all files in project |
| `GET` | `/api/projects/:id/knowledge-health` | Run lint checks and return results |
| `GET` | `/api/projects/:id/index` | Return generated index.md content |
| `GET` | `/api/projects/:id/log` | Return log.md content |
