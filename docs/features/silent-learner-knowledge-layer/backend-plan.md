# Backend Plan: Silent Learner Knowledge Layer

## Overview

This plan covers all backend implementation for the Silent Learner Knowledge Layer feature. The work is organized into 5 phases, where Phases 1+2 and Phases 3+4 can be developed in parallel respectively. Phase 5 builds on all previous work.

**Related documents:**
- [PRD](/docs/features/silent-learner-knowledge-layer/prd.md)
- [Analysis](/docs/features/silent-learner-knowledge-layer/analysis_results.md)
- [Existing Silent Learner Architecture](/docs/features/silent-learner/architecture.md)
- [Existing Artifacts Module](/node-backend/lib/artifacts.mjs)

---

## Phase 1: OKF-Aligned Sidecar Enrichment

**Goal:** Extend existing sidecar schema with OKF-level metadata and implement a progressive auto-enrichment pipeline for imported files.

**Can run in parallel with:** Phase 2

### Files to Modify

#### [MODIFY] [artifacts.mjs](/node-backend/lib/artifacts.mjs)
- Extend `writeArtifactSidecar()` to include new OKF-aligned fields (`description`, `tags`, `resource`, `citations`, `silentLearner` block)
- Modify `createArtifact()` and `convertFileToArtifact()` to invoke Phase 1 enrichment (hash + type + title)
- Add `enrichmentLevel` field to sidecar schema: `"minimal"` | `"partial"` | `"full"`
- Ensure backward compatibility: new fields default to `undefined`/empty if not enriched yet

#### [NEW] `node-backend/lib/silent-learner/enrichment.mjs`
Core enrichment pipeline module with three stages:

```javascript
// Stage 1: Immediate (synchronous, runs at import time)
export async function enrichImmediate(projectId, filePath) {
  // - Compute SHA-256 content hash
  // - Classify file type (heuristic: extension + content pattern matching)
  // - Extract title (first H1 for .md, filename stem otherwise)
  // - Write minimal sidecar with enrichmentLevel: "minimal"
}

// Stage 2: Background (async, runs via background worker)
export async function enrichDeep(projectId, filePath, sidecar) {
  // - Generate one-line description/summary
  //   → If AI provider available: LLM-generated summary
  //   → Fallback: first non-heading paragraph, truncated to 160 chars
  // - Extract tags via topic detection
  //   → If AI provider: LLM-extracted topics
  //   → Fallback: regex-based keyword extraction (headings, bold text, repeated terms)
  // - Extract named entities (product names, competitors, people, technologies)
  // - Update sidecar with enrichmentLevel: "full"
}

// Stage 3: Relational (runs after deep enrichment or on interaction)
export async function enrichRelational(projectId, filePath, sidecar) {
  // - Scan existing sidecars for matching entities → populate sourceRefs
  // - Build co-occurrence links with related files
  // - Compute initial Silent Learner scores
  // - Update sidecar.silentLearner block
}
```

#### [NEW] `node-backend/lib/silent-learner/content-classifier.mjs`
Heuristic file type classifier (no AI required):

```javascript
export function classifyFileType(filePath, content) {
  // Returns one of: 'research', 'spec', 'notes', 'data', 'report',
  //                  'competitive-analysis', 'meeting-notes', 'transcript',
  //                  'prd', 'roadmap', 'user-story', 'initiative', 'unknown'
  // 
  // Heuristics:
  // - Check against known TYPE_DIRS patterns
  // - Content pattern matching (e.g., "## User Stories" → spec)
  // - Filename pattern matching (e.g., "meeting-*" → meeting-notes)
  // - Heading structure analysis
}
```

#### [NEW] `node-backend/lib/silent-learner/entity-extractor.mjs`
Entity extraction from document content:

```javascript
export function extractEntitiesHeuristic(content) {
  // Regex-based: extract capitalized multi-word terms, @mentions, URLs, code references
  // Returns: { entities: string[], keywords: string[] }
}

export async function extractEntitiesAI(content, provider) {
  // LLM-based: prompt the AI to extract entities, topics, and a one-line summary
  // Returns: { entities: string[], keywords: string[], summary: string, tags: string[] }
}
```

#### [MODIFY] [server.mjs](/node-backend/server.mjs)
- Add `POST /api/projects/:id/enrich` endpoint to trigger full project enrichment
- Hook file import/creation events to trigger `enrichImmediate()` synchronously
- Add background enrichment queue that processes `enrichDeep()` for files with `enrichmentLevel: "minimal"`

### Data Model Changes

**Extended sidecar JSON schema:**
```json
{
  "id": "string (relative path)",
  "artifactType": "string",
  "title": "string",
  "description": "string | null",
  "tags": ["string"],
  "resource": "string (relative path)",
  "sourceRefs": ["string (relative path)"],
  "citations": ["string (URL)"],
  "projectId": "string",
  "created": "ISO 8601",
  "updated": "ISO 8601",
  "metadata": {},
  "silentLearner": {
    "confidence": "number (0-1)",
    "usageConsistency": "number (0-1)",
    "recencyScore": "number (0-1)",
    "taskAlignment": "number (0-1)",
    "compositeScore": "number (0-1)",
    "lastObserved": "ISO 8601 | null",
    "relatedConcepts": ["string"],
    "contentHash": "string (sha256)",
    "enrichmentLevel": "'minimal' | 'partial' | 'full'",
    "enrichedAt": "ISO 8601"
  }
}
```

### Backward Compatibility
- Existing sidecars without new fields continue working (all new fields optional)
- `reconcileArtifacts()` detects sidecars missing `silentLearner` block and queues them for enrichment
- No changes to manifest structure (`artifacts.json`)

### Testing (Phase 1)

| Test | Type | Description |
|---|---|---|
| `enrichment-immediate.test.mjs` | Unit | `enrichImmediate()` produces correct hash, type, title for various file types |
| `content-classifier.test.mjs` | Unit | `classifyFileType()` correctly identifies known patterns (prd, research, notes, unknown) |
| `entity-extractor.test.mjs` | Unit | Heuristic extractor finds capitalized terms, @mentions, URLs |
| `enrichment-deep.test.mjs` | Unit | `enrichDeep()` with AI fallback produces summary, tags; fallback works without provider |
| `enrichment-relational.test.mjs` | Unit | Cross-reference discovery populates `sourceRefs` correctly |
| `sidecar-backward-compat.test.mjs` | Integration | Existing sidecars without new fields load without errors |
| `import-triggers-enrichment.test.mjs` | Integration | File creation/import triggers `enrichImmediate()` and queues `enrichDeep()` |
| `enrich-endpoint.test.mjs` | API | `POST /api/projects/:id/enrich` processes all files and returns status |

---

## Phase 2: `index.md` + `log.md` Auto-Generation

**Goal:** Implement auto-generated navigation files that give humans and LLMs a fast entrypoint to project knowledge.

**Can run in parallel with:** Phase 1

### Files to Create/Modify

#### [NEW] `node-backend/lib/silent-learner/index-generator.mjs`
Auto-generates `index.md` from sidecars and manifest:

```javascript
export async function generateIndex(projectId) {
  // 1. Read all sidecars in project
  // 2. Group by artifactType
  // 3. Sort each group by compositeScore (desc), then title (asc)
  // 4. Generate markdown with links, descriptions, metadata
  // 5. Write to project root as index.md
  // Returns: generated markdown string
}

export async function regenerateIndexIfStale(projectId) {
  // Compare index.md timestamp with latest sidecar update
  // Only regenerate if stale
}
```

**Generated format:**
```markdown
# Project Knowledge Index
<!-- Auto-generated by Silent Learner. Last updated: 2026-06-18T16:00:00Z -->

## PRDs (3 artifacts)
- [Mobile App Redesign](prds/mobile-app-redesign.md) — Core mobile UX overhaul _(score: 0.85, updated: Jun 15)_
- [Silent Learner Mode](prds/silent-learner-mode.md) — Privacy-first learning system _(score: 0.91, updated: Jun 17)_

## Research (5 documents)
- [Competitor Analysis](competitor-analysis.md) — Market positioning review _(score: 0.72)_
...

## Knowledge (Auto-maintained)
- [Competitor Tool X](knowledge/competitor-tool-x.md) — Feature comparison _(sources: 3, score: 0.88)_
```

#### [NEW] `node-backend/lib/silent-learner/log-writer.mjs`
Append-only log of knowledge events:

```javascript
export async function appendLog(projectId, eventType, title, details) {
  // eventType: 'import' | 'enrich' | 'learn' | 'lint' | 'query'
  // Appends formatted entry to log.md in project root
  // Format: ## [YYYY-MM-DD HH:mm] eventType | title
  //         details
}

export async function readLog(projectId, options = { limit: 50 }) {
  // Returns last N log entries
}
```

#### [MODIFY] [artifacts.mjs](/node-backend/lib/artifacts.mjs)
- After `writeManifest()`, trigger `regenerateIndexIfStale()`
- After artifact CRUD operations, call `appendLog()` with appropriate event type

#### [MODIFY] [server.mjs](/node-backend/server.mjs)
- Add `GET /api/projects/:id/index` to return index.md content
- Add `GET /api/projects/:id/log` to return log.md entries (with pagination)

### Testing (Phase 2)

| Test | Type | Description |
|---|---|---|
| `index-generator.test.mjs` | Unit | `generateIndex()` produces correct markdown grouping, sorting, links |
| `index-generator-empty.test.mjs` | Unit | Empty project generates valid but empty index |
| `index-staleness.test.mjs` | Unit | `regenerateIndexIfStale()` only regenerates when needed |
| `log-writer.test.mjs` | Unit | `appendLog()` produces correct format, appends (doesn't overwrite) |
| `log-reader.test.mjs` | Unit | `readLog()` returns entries in reverse chronological order with limit |
| `index-endpoint.test.mjs` | API | `GET /api/projects/:id/index` returns generated content |
| `log-endpoint.test.mjs` | API | `GET /api/projects/:id/log` returns paginated entries |
| `artifact-crud-triggers-index.test.mjs` | Integration | Creating/updating/deleting artifact triggers index regeneration |
| `artifact-crud-triggers-log.test.mjs` | Integration | CRUD operations append correct log entries |

---

## Phase 3: Compounding Knowledge Artifacts

**Goal:** Enable Silent Learner to create and maintain LLM-generated knowledge pages that synthesize information across multiple source files and interactions.

**Can run in parallel with:** Phase 4
**Depends on:** Phase 1 (sidecar enrichment for entity extraction)

### Files to Create/Modify

#### [MODIFY] [artifacts.mjs](/node-backend/lib/artifacts.mjs)
- Add new entries to `TYPE_DIRS`:
```javascript
export const TYPE_DIRS = {
  // ... existing types ...
  knowledge_page: 'knowledge',
  synthesis: 'syntheses',
  lesson_learned: 'lessons',
};
```
- Update `normalizeArtifactFolder()` alias map for new folders

#### [NEW] `node-backend/lib/silent-learner/knowledge-builder.mjs`
Core module that creates and updates knowledge pages:

```javascript
export async function shouldCreateKnowledgePage(projectId, conceptName) {
  // Returns true if the concept has been referenced in 3+ interactions
  // Uses co-occurrence data from learning event store
}

export async function createKnowledgePage(projectId, conceptName, sources) {
  // 1. Gather all sidecar data mentioning this concept
  // 2. Read relevant source file content
  // 3. Generate a synthesis page via LLM
  // 4. Create artifact of type 'knowledge_page' in knowledge/ folder
  // 5. Write sidecar with sourceRefs pointing to all contributing files
  // 6. Append to log.md
  // 7. Regenerate index.md
}

export async function updateKnowledgePage(projectId, knowledgePageId, newSources) {
  // 1. Read existing knowledge page content
  // 2. Read new source content
  // 3. Generate updated page via LLM (merge new info into existing)
  // 4. Update artifact content
  // 5. Update sidecar sourceRefs
  // 6. Append to log.md
}

export async function createSynthesis(projectId, title, sourceArtifactIds) {
  // Creates a cross-cutting synthesis page connecting multiple artifacts
}

export async function createLessonLearned(projectId, pattern, examples) {
  // Distills a repeated pattern observed by Silent Learner into a lesson
}
```

#### [MODIFY] `node-backend/lib/silent-learner/capture-hook.mjs`
- After capturing an interaction, check entities mentioned against knowledge page thresholds
- If threshold met (3+ mentions), trigger `createKnowledgePage()` or `updateKnowledgePage()`

### Testing (Phase 3)

| Test | Type | Description |
|---|---|---|
| `knowledge-builder-threshold.test.mjs` | Unit | `shouldCreateKnowledgePage()` returns true only after 3+ references |
| `knowledge-builder-create.test.mjs` | Unit | `createKnowledgePage()` generates valid markdown with citations |
| `knowledge-builder-update.test.mjs` | Unit | `updateKnowledgePage()` merges new info without losing existing content |
| `knowledge-builder-synthesis.test.mjs` | Unit | `createSynthesis()` cross-references multiple sources correctly |
| `knowledge-builder-lesson.test.mjs` | Unit | `createLessonLearned()` produces structured lesson format |
| `type-dirs-knowledge.test.mjs` | Unit | New TYPE_DIRS entries normalize correctly |
| `capture-triggers-knowledge.test.mjs` | Integration | Interaction capture triggers knowledge page creation at threshold |
| `knowledge-page-sidecar.test.mjs` | Integration | Created knowledge pages have proper sidecars with sourceRefs |

---

## Phase 4: Knowledge Lint/Health-Check Operations

**Goal:** Implement health checks that detect stale, orphaned, contradictory, or duplicate knowledge.

**Can run in parallel with:** Phase 3
**Depends on:** Phase 1 (sidecar enrichment for content hashes and scoring)

### Files to Create/Modify

#### [NEW] `node-backend/lib/silent-learner/knowledge-lint.mjs`

```javascript
export async function runLintChecks(projectId) {
  // Returns array of lint findings
  const findings = [];
  findings.push(...await detectOrphanArtifacts(projectId));
  findings.push(...await detectStaleContent(projectId));
  findings.push(...await detectStaleSidecars(projectId));
  findings.push(...await detectDuplicates(projectId));
  findings.push(...await detectMissingCoverage(projectId));
  return findings;
}

// Finding schema:
// { type: 'orphan'|'stale'|'stale-sidecar'|'duplicate'|'missing-coverage',
//   severity: 'info'|'warning'|'error',
//   artifactId: string,
//   message: string,
//   suggestion: string }
```

**Individual lint checks:**

| Check | Implementation |
|---|---|
| `detectOrphanArtifacts` | Scan sidecars; find artifacts with zero inbound `sourceRefs` from other sidecars |
| `detectStaleContent` | Find artifacts with `updated` > 30 days ago AND `silentLearner.usageConsistency` was previously > 0.5 |
| `detectStaleSidecars` | Compare `silentLearner.contentHash` with current file hash; flag mismatches |
| `detectDuplicates` | Simple content hash comparison first; then heading/title similarity for near-dupes |
| `detectMissingCoverage` | Scan entities in sidecars that appear 3+ times but have no knowledge page |

#### [MODIFY] [server.mjs](/node-backend/server.mjs)
- Add `GET /api/projects/:id/knowledge-health` endpoint
- Returns lint findings grouped by severity

### Testing (Phase 4)

| Test | Type | Description |
|---|---|---|
| `lint-orphans.test.mjs` | Unit | Correctly identifies artifacts with no inbound references |
| `lint-stale-content.test.mjs` | Unit | Flags old artifacts that were previously high-engagement |
| `lint-stale-sidecars.test.mjs` | Unit | Detects content hash mismatches between file and sidecar |
| `lint-duplicates.test.mjs` | Unit | Finds exact and near-duplicate artifacts |
| `lint-missing-coverage.test.mjs` | Unit | Identifies entities needing knowledge pages |
| `lint-full-run.test.mjs` | Integration | `runLintChecks()` returns correctly structured findings for a mixed project |
| `knowledge-health-endpoint.test.mjs` | API | `GET /api/projects/:id/knowledge-health` returns grouped findings |

---

## Phase 5: Silent Learner as Knowledge Maintainer (Closed Loop)

**Goal:** Integrate the scoring engine with the knowledge builder to create a self-maintaining knowledge loop.

**Depends on:** Phases 1-4

### Files to Modify

#### [MODIFY] `node-backend/lib/silent-learner/index.mjs`
Extend the main Silent Learner state machine with knowledge maintenance:

```javascript
// New state transitions:
// OBSERVING → ENRICHING → BUILDING_KNOWLEDGE → LINTING → IDLE
//
// On each interaction capture:
// 1. Update sidecar scores (existing)
// 2. Check knowledge page thresholds (Phase 3)
// 3. Run periodic lint (Phase 4, debounced)
// 4. Regenerate index.md if stale (Phase 2)
```

#### [MODIFY] `node-backend/lib/silent-learner/scoring.mjs`
Add knowledge maintenance output paths:

```javascript
// After computing score S:
// S >= 0.7 → Active context + auto-maintain knowledge pages
// 0.4 <= S < 0.7 → RAG-only + suggest knowledge page if entity count >= 3
// S < 0.4 → Cold storage + flag for lint if previously high-scoring
```

#### [MODIFY] `node-backend/lib/silent-learner/retrieval.mjs`
Update context assembly to use the knowledge layer:

```javascript
// Updated retrieval flow:
// 1. Read index.md for fast artifact discovery
// 2. Score-filter artifacts via sidecars (no content parsing needed)
// 3. Inject knowledge pages preferentially (they're pre-synthesized)
// 4. Fill remaining token budget with scored raw sources
```

### Testing (Phase 5)

| Test | Type | Description |
|---|---|---|
| `closed-loop-state-machine.test.mjs` | Unit | State transitions fire in correct order |
| `scoring-knowledge-path.test.mjs` | Unit | High-scoring entities trigger knowledge page creation |
| `scoring-lint-path.test.mjs` | Unit | Decayed entities trigger lint flags |
| `retrieval-knowledge-priority.test.mjs` | Unit | Knowledge pages are prioritized in context assembly |
| `retrieval-index-bootstrap.test.mjs` | Unit | Context assembly reads index.md for fast discovery |
| `end-to-end-compounding.test.mjs` | Integration | Import → interact → knowledge page created → next session uses it |

---

## Performance Considerations

| Concern | Mitigation |
|---|---|
| Enrichment CPU spike on large imports | Batch queue with configurable concurrency (default: 3 files at a time) |
| index.md regeneration frequency | Debounced: regenerate at most once per 30 seconds |
| log.md file size growth | Rotate after 10,000 entries; keep archive |
| Background enrichment blocking UI | All Phase 2 enrichment runs in async background worker |
| Sidecar write I/O | Debounced writes (existing 30s debounce policy) |

---

## Backward Compatibility

- All sidecar changes are additive (new fields, no field removals or renames)
- Existing projects without enriched sidecars work as before
- `reconcileArtifacts()` detects unenriched sidecars and queues enrichment
- `index.md` and `log.md` are auto-generated and can be deleted safely (regenerated)
- Knowledge pages (knowledge/, lessons/, syntheses/) are new directories; no conflict with existing
