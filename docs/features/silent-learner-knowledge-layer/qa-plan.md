# QA Plan: Silent Learner Knowledge Layer

## Overview

This QA plan covers the testing strategy for all 5 phases of the Silent Learner Knowledge Layer feature. Tests are organized by phase to support the parallel development strategy.

**Related documents:**
- [PRD](/docs/features/silent-learner-knowledge-layer/prd.md)
- [Backend Plan](/docs/features/silent-learner-knowledge-layer/backend-plan.md)

---

## Risk-Based Test Matrix

| Risk | Severity | Likelihood | Priority | Covered In |
|---|---|---|---|---|
| Sidecar enrichment corrupts existing sidecars | High | Medium | **P0** | Phase 1 backward compat tests |
| Background enrichment blocks UI/server | High | Low | **P0** | Phase 1 async tests |
| index.md regeneration overwrites user edits | Medium | Low | **P1** | Phase 2 regeneration tests |
| Knowledge page generation produces inaccurate content | Medium | Medium | **P1** | Phase 3 content quality tests |
| Lint false positives cause user confusion | Low | Medium | **P2** | Phase 4 lint accuracy tests |
| Large project (500+ files) causes performance degradation | High | Medium | **P0** | Cross-phase performance tests |
| Content hash collision causes missed re-enrichment | Low | Low | **P2** | Phase 1 hash tests |
| File system race conditions during concurrent enrichment | Medium | Low | **P1** | Phase 1 concurrency tests |

---

## Phase 1 Tests: OKF-Aligned Sidecar Enrichment

### Unit Tests

**File: `node-backend/tests/silent-learner/enrichment-immediate.test.mjs`**

| # | Test Case | Input | Expected Output |
|---|---|---|---|
| 1.1 | Hash computation for markdown file | `test.md` with known content | Correct SHA-256 hash |
| 1.2 | Hash computation for empty file | Empty `test.md` | Valid hash (hash of empty string) |
| 1.3 | Type classification for PRD-like content | MD with "## User Stories" heading | `artifactType: "prd"` |
| 1.4 | Type classification for meeting notes | MD with "## Attendees", "## Action Items" | `artifactType: "meeting-notes"` |
| 1.5 | Type classification for unknown content | Random text | `artifactType: "unknown"` |
| 1.6 | Title extraction from H1 | MD starting with `# My Title` | `title: "My Title"` |
| 1.7 | Title extraction from filename | MD without H1, filename `market-research.md` | `title: "Market Research"` |
| 1.8 | Minimal sidecar schema | Any file | Sidecar has `enrichmentLevel: "minimal"`, `contentHash`, `title` |

**File: `node-backend/tests/silent-learner/content-classifier.test.mjs`**

| # | Test Case | Expected |
|---|---|---|
| 2.1 | File in `prds/` directory | Returns `prd` type |
| 2.2 | File in `roadmaps/` directory | Returns `roadmap` type |
| 2.3 | File with competitive keywords | Returns `competitive-analysis` |
| 2.4 | File with "meeting" in name | Returns `meeting-notes` |
| 2.5 | File with interview transcript pattern | Returns `transcript` |
| 2.6 | Plain text with no patterns | Returns `unknown` |
| 2.7 | Non-markdown file (.txt) | Returns classification based on content, not extension |

**File: `node-backend/tests/silent-learner/entity-extractor.test.mjs`**

| # | Test Case | Expected |
|---|---|---|
| 3.1 | Extract capitalized multi-word terms | `["Product Hunt", "Silent Learner"]` |
| 3.2 | Extract @mentions | `["@competitor-x", "@team-lead"]` |
| 3.3 | Extract URLs | `["https://example.com"]` |
| 3.4 | No entities in simple text | Empty array |
| 3.5 | Deduplicate repeated entities | Each entity appears once |
| 3.6 | AI fallback when provider unavailable | Falls back to heuristic extraction |

**File: `node-backend/tests/silent-learner/enrichment-deep.test.mjs`**

| # | Test Case | Expected |
|---|---|---|
| 4.1 | Summary generation with AI provider | `description` field populated with one-line summary |
| 4.2 | Summary fallback without AI provider | `description` uses first paragraph (truncated to 160 chars) |
| 4.3 | Tag extraction with AI provider | `tags` array populated |
| 4.4 | Tag fallback without AI provider | Tags from headings and bold text |
| 4.5 | Enrichment level updated | `enrichmentLevel` changes from `"minimal"` to `"full"` |
| 4.6 | `enrichedAt` timestamp set | Valid ISO 8601 timestamp |

### Integration Tests

**File: `node-backend/tests/silent-learner/enrichment-integration.test.mjs`**

| # | Test Case | Expected |
|---|---|---|
| 5.1 | Backward compat: load existing sidecar without SL fields | No errors; new fields default to undefined |
| 5.2 | Import file triggers `enrichImmediate()` | Sidecar created with minimal enrichment |
| 5.3 | Background worker processes queued enrichment | Sidecar updated from `"minimal"` to `"full"` |
| 5.4 | Re-enrich after content change | Hash mismatch detected; sidecar re-enriched |
| 5.5 | Concurrent enrichment of multiple files | No race conditions; all sidecars correct |
| 5.6 | `POST /api/projects/:id/enrich` processes all files | All sidecars updated |
| 5.7 | Enrichment of 100+ files completes within 60s | Batched processing with 3-file concurrency |

---

## Phase 2 Tests: `index.md` + `log.md`

### Unit Tests

**File: `node-backend/tests/silent-learner/index-generator.test.mjs`**

| # | Test Case | Expected |
|---|---|---|
| 6.1 | Generate index for project with 5 artifacts | Markdown with grouped sections, links, descriptions |
| 6.2 | Generate index for empty project | Valid markdown with header only |
| 6.3 | Artifacts sorted by score within groups | Higher score first |
| 6.4 | Knowledge pages in separate "Auto-maintained" section | Grouped correctly |
| 6.5 | Staleness check: index older than latest sidecar | Returns true (needs regeneration) |
| 6.6 | Staleness check: index newer than all sidecars | Returns false |

**File: `node-backend/tests/silent-learner/log-writer.test.mjs`**

| # | Test Case | Expected |
|---|---|---|
| 7.1 | Append import event | Correct format: `## [date] import \| title` |
| 7.2 | Append learn event | Correct format with details |
| 7.3 | Append to existing log | Previous entries preserved |
| 7.4 | Create log from scratch | File created with first entry |
| 7.5 | Read last 5 entries | Returns 5 most recent in reverse chronological order |
| 7.6 | Read with limit exceeding total | Returns all entries |

### Integration Tests

**File: `node-backend/tests/silent-learner/navigation-integration.test.mjs`**

| # | Test Case | Expected |
|---|---|---|
| 8.1 | Creating artifact regenerates index | index.md updated within debounce window |
| 8.2 | Deleting artifact regenerates index | Deleted artifact removed from index |
| 8.3 | Artifact CRUD appends to log | Correct event types in log |
| 8.4 | API: GET index returns markdown | Status 200, valid markdown content |
| 8.5 | API: GET log returns paginated entries | Correct pagination with default limit |
| 8.6 | index.md not regenerated if not stale | File timestamp unchanged |

---

## Phase 3 Tests: Compounding Knowledge Artifacts

### Unit Tests

**File: `node-backend/tests/silent-learner/knowledge-builder.test.mjs`**

| # | Test Case | Expected |
|---|---|---|
| 9.1 | Threshold check: entity with 2 mentions | Returns false (below 3) |
| 9.2 | Threshold check: entity with 3 mentions | Returns true |
| 9.3 | Create knowledge page generates valid markdown | H1 title, source citations, structured content |
| 9.4 | Knowledge page sidecar has sourceRefs | Links back to all contributing source files |
| 9.5 | Update knowledge page merges new info | New information added without losing existing |
| 9.6 | Create synthesis cross-references sources | Multiple sourceRefs populated |
| 9.7 | Create lesson learned from patterns | Structured format with examples |
| 9.8 | New TYPE_DIRS entries normalize correctly | `normalizeArtifactFolder('knowledge')` returns `'knowledge'` |

### Integration Tests

**File: `node-backend/tests/silent-learner/knowledge-integration.test.mjs`**

| # | Test Case | Expected |
|---|---|---|
| 10.1 | 3rd mention of entity triggers page creation | knowledge/entity.md created |
| 10.2 | Knowledge page appears in index.md | Listed under "Knowledge" section |
| 10.3 | Knowledge page creation logged | log.md entry with `learn` event type |
| 10.4 | Knowledge page update preserves existing content | Diff shows additions, not replacements |
| 10.5 | Knowledge page visible in artifacts list API | Returns with `artifactType: "knowledge_page"` |

---

## Phase 4 Tests: Knowledge Lint

### Unit Tests

**File: `node-backend/tests/silent-learner/knowledge-lint.test.mjs`**

| # | Test Case | Expected |
|---|---|---|
| 11.1 | Orphan detection: artifact with no inbound refs | Finding: type=orphan |
| 11.2 | Orphan detection: well-connected artifact | No finding |
| 11.3 | Stale content: 31-day-old high-engagement artifact | Finding: type=stale |
| 11.4 | Stale content: 31-day-old low-engagement artifact | No finding (was never important) |
| 11.5 | Stale sidecar: hash mismatch | Finding: type=stale-sidecar |
| 11.6 | Stale sidecar: hash matches | No finding |
| 11.7 | Duplicate detection: identical content hash | Finding: type=duplicate |
| 11.8 | Missing coverage: entity in 3+ sidecars, no knowledge page | Finding: type=missing-coverage |
| 11.9 | Full lint run returns structured findings | Array of findings grouped by severity |

### Integration Tests

**File: `node-backend/tests/silent-learner/lint-integration.test.mjs`**

| # | Test Case | Expected |
|---|---|---|
| 12.1 | API: GET knowledge-health returns findings | Status 200, findings array |
| 12.2 | Lint results logged | log.md entry with `lint` event type |
| 12.3 | Lint on empty project | No findings (no errors) |
| 12.4 | Lint on project with known issues | Correct findings for each issue type |

---

## Phase 5 Tests: Closed-Loop Integration

### Unit Tests

**File: `node-backend/tests/silent-learner/closed-loop.test.mjs`**

| # | Test Case | Expected |
|---|---|---|
| 13.1 | State machine transitions correctly | OBSERVING → ENRICHING → BUILDING → LINTING → IDLE |
| 13.2 | High-score entity triggers knowledge maintenance | Score ≥ 0.7 → knowledge page created/updated |
| 13.3 | Medium-score entity suggests knowledge page | 0.4 ≤ S < 0.7 with 3+ mentions → suggestion |
| 13.4 | Decayed entity flagged for lint | S < 0.4 after being > 0.7 → lint flag |
| 13.5 | Knowledge pages prioritized in retrieval | Knowledge pages injected before raw sources |
| 13.6 | index.md used for fast discovery | Retrieval reads index.md first |

### End-to-End Integration Test

**File: `node-backend/tests/silent-learner/e2e-compounding.test.mjs`**

| # | Test Case | Description |
|---|---|---|
| 14.1 | Full import-to-learn journey | Import 3 files → auto-enrich → interact 3 times mentioning same entity → knowledge page auto-created → verify next retrieval includes knowledge page |
| 14.2 | Progressive enrichment lifecycle | Import file → verify minimal sidecar → wait for background → verify full sidecar → modify file → verify re-enrichment |
| 14.3 | Knowledge compounding across sessions | Session 1: discuss entity X → Session 2: discuss entity X again → verify knowledge page updated with new info |

---

## Exit Criteria for Release

| Criterion | Required |
|---|---|
| All P0 tests pass | ✅ Yes |
| All P1 tests pass | ✅ Yes |
| P2 tests: ≥ 90% pass rate | ✅ Yes |
| No regressions in existing artifact CRUD tests | ✅ Yes |
| No regressions in existing Silent Learner tests | ✅ Yes |
| Performance: 100-file enrichment < 60s | ✅ Yes |
| Performance: index.md generation < 2s | ✅ Yes |
| Performance: lint run < 5s for 100-artifact project | ✅ Yes |
| Backward compat: existing projects load without errors | ✅ Yes |

---

## Regression Scope

Tests to run for every phase to ensure no regressions:

```bash
# Existing artifact tests
npm test -- --test-path-pattern='artifacts'

# Existing silent learner tests
npm test -- --test-path-pattern='silent-learner'

# File service tests
npm test -- --test-path-pattern='files'

# Project tests
npm test -- --test-path-pattern='projects'
```
