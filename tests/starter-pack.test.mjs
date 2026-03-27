import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPersonalContextDoc, PERSONAL_STARTER_WORKFLOWS } from '../src/lib/starterPack.testable.mjs';

test('buildPersonalContextDoc includes key personal context sections', () => {
  const doc = buildPersonalContextDoc({
    companyName: 'Acme',
    productName: 'Acme Mobile',
    primaryPersona: 'SMB PM',
    topCompetitors: 'Notion, Asana',
  });

  assert.ok(doc.includes('## Company'));
  assert.ok(doc.includes('Acme'));
  assert.ok(doc.includes('## Product'));
  assert.ok(doc.includes('## Primary Persona'));
  assert.ok(doc.includes('- Notion'));
  assert.ok(doc.includes('- Asana'));
});

test('starter workflows include core personal PM flows', () => {
  assert.ok(PERSONAL_STARTER_WORKFLOWS.length >= 3);
  const names = PERSONAL_STARTER_WORKFLOWS.map((w) => w.name);
  assert.ok(names.includes('PRD Draft Workflow'));
  assert.ok(names.includes('Competitor Snapshot Workflow'));
});
