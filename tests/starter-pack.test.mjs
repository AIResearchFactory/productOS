import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCompetitorsDoc,
  buildPersonalContextDoc,
  buildPersonasDoc,
  PERSONAL_STARTER_WORKFLOWS,
} from '../src/lib/starterPack.testable.mjs';

test('buildPersonalContextDoc includes key product context sections', () => {
  const doc = buildPersonalContextDoc({
    companyName: 'Acme',
    productName: 'Acme Mobile',
    productGoal: 'Increase activation',
    primaryPersona: 'SMB PM',
    topCompetitors: 'Notion, Asana',
  });

  assert.ok(doc.includes('## Company'));
  assert.ok(doc.includes('Acme'));
  assert.ok(doc.includes('## Product'));
  assert.ok(doc.includes('## Current Goal'));
  assert.ok(doc.includes('Increase activation'));
});

test('buildPersonasDoc scaffolds multi-persona structure', () => {
  const doc = buildPersonasDoc({ primaryPersona: 'SMB PM' });
  assert.ok(doc.includes('# Personas'));
  assert.ok(doc.includes('## Persona 1'));
  assert.ok(doc.includes('Name: SMB PM'));
  assert.ok(doc.includes('## Persona 2'));
});

test('buildCompetitorsDoc scaffolds competitors table', () => {
  const doc = buildCompetitorsDoc({ topCompetitors: 'Notion, Asana' });
  assert.ok(doc.includes('| Competitor | Positioning | Strengths | Weaknesses |'));
  assert.ok(doc.includes('| Notion |'));
  assert.ok(doc.includes('| Asana |'));
});

test('starter workflows include core personal PM flows', () => {
  assert.ok(PERSONAL_STARTER_WORKFLOWS.length >= 3);
  const names = PERSONAL_STARTER_WORKFLOWS.map((w) => w.name);
  assert.ok(names.includes('PRD Draft Workflow'));
  assert.ok(names.includes('Competitor Snapshot Workflow'));
});
