import test from 'node:test';
import assert from 'node:assert/strict';
import { detectArtifactKind, validateArtifactQuality } from '../src/lib/artifactQuality.js';

test('detectArtifactKind resolves supported types from path', () => {
  assert.equal(detectArtifactKind('prds/my-prd.md'), 'prd');
  assert.equal(detectArtifactKind('roadmaps/q3-roadmap.md'), 'roadmap');
  assert.equal(detectArtifactKind('one-pagers/launch.md'), 'one_pager');
  assert.equal(detectArtifactKind('notes/random.md'), null);
});

test('validateArtifactQuality flags missing sections for PRD with rationale and suggestion', () => {
  const content = '# My PRD\n\n## Problem\nA\n\n## Goals\nB';
  const issues = validateArtifactQuality(content, 'prd');
  const reqIssue = issues.find((i) => i.key === 'requirements');
  const metricIssue = issues.find((i) => i.key === 'metrics');
  assert.ok(reqIssue);
  assert.ok(metricIssue);
  assert.ok(reqIssue?.reason?.length > 10);
  assert.ok(reqIssue?.suggestion?.length > 10);
});

test('validateArtifactQuality passes complete roadmap', () => {
  const content = '# Roadmap\n\n## Vision\nA\n\n## Strategic Themes\nB\n\n## Timeline\nC';
  const issues = validateArtifactQuality(content, 'roadmap');
  assert.equal(issues.length, 0);
});
