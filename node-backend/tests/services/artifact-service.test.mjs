import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createArtifact, getArtifact, deleteArtifact, reconcileArtifacts, convertFileToArtifact, handleFileRename } from '../../../node-backend/lib/artifacts.mjs';
import { clearEnrichmentQueue, drainEnrichmentQueue } from '../../../node-backend/lib/silent-learner/enrichment.mjs';
import * as projects from '../../../node-backend/lib/projects.mjs';

let tempProjectsDir;
let tempProjectId = 'test-proj-artifacts';
let projectPath;
let tempHomeDir;

beforeEach(async () => {
  tempProjectsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'productOS-tests-artifacts-'));
  process.env.PROJECTS_DIR = tempProjectsDir;
  
  // Isolate HOME directory to avoid accessing real user data
  tempHomeDir = path.join(tempProjectsDir, 'home');
  await fs.mkdir(tempHomeDir, { recursive: true });
  process.env.HOME = tempHomeDir;

  projectPath = path.join(tempProjectsDir, tempProjectId);
  await fs.mkdir(path.join(projectPath, '.metadata'), { recursive: true });
  await fs.writeFile(path.join(projectPath, '.metadata', 'project.json'), JSON.stringify({ id: tempProjectId, name: 'Test' }));
});

afterEach(async () => {
  clearEnrichmentQueue();
  await drainEnrichmentQueue();
  await fs.rm(tempProjectsDir, { recursive: true, force: true });
  delete process.env.PROJECTS_DIR;
  delete process.env.HOME;
});

test('Artifact Service - create and get', async () => {
  const artifact = await createArtifact(tempProjectId, 'roadmap', 'My Roadmap');
  assert.strictEqual(artifact.title, 'My Roadmap');
  assert.strictEqual(artifact.artifactType, 'roadmap');
  
  const loaded = await getArtifact(tempProjectId, artifact.id);
  assert.strictEqual(loaded.title, 'My Roadmap');
});

test('Artifact Service - delete', async () => {
  const artifact = await createArtifact(tempProjectId, 'task', 'To Delete');
  await deleteArtifact(tempProjectId, artifact.id);
  
  await assert.rejects(
    async () => await getArtifact(tempProjectId, artifact.id),
    { message: /not found/i }
  );
});

test('Artifact Service - reconcile and legacy migration', async () => {
  // Create a legacy directory and write an artifact there
  const legacyDir = path.join(projectPath, 'prd');
  await fs.mkdir(legacyDir, { recursive: true });
  await fs.writeFile(path.join(legacyDir, 'spec.md'), '# Spec Title\n', 'utf8');

  // Create a manifest with the legacy path
  const manifestData = [
    {
      id: 'prd/spec.md',
      artifactType: 'prd',
      title: 'Spec Title',
      projectId: tempProjectId,
      path: 'prd/spec.md',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    }
  ];
  await fs.writeFile(
    path.join(projectPath, '.metadata', 'artifacts.json'),
    JSON.stringify(manifestData, null, 2),
    'utf8'
  );

  // Reconcile
  const count = await reconcileArtifacts(tempProjectId);
  
  // Verify file has been migrated to canonical 'prds'
  const newPath = path.join(projectPath, 'prds', 'spec.md');
  const newExists = await fs.access(newPath).then(() => true).catch(() => false);
  assert.ok(newExists, 'File should be migrated to canonical prds folder');

  // Verify legacy directory was deleted
  const legacyExists = await fs.access(legacyDir).then(() => true).catch(() => false);
  assert.ok(!legacyExists, 'Legacy directory prd should be removed');

  // Verify manifest was updated correctly
  const rawManifest = await fs.readFile(path.join(projectPath, '.metadata', 'artifacts.json'), 'utf8');
  const manifest = JSON.parse(rawManifest);
  assert.strictEqual(manifest.length, 1);
  assert.strictEqual(manifest[0].path, 'prds/spec.md');
  assert.strictEqual(manifest[0].id, 'prds/spec.md');
});

test('Artifact Service - reconcile and merge legacy duplicate manifest entry', async () => {
  // Create a legacy file and canonical file (simulating post-migration or rename crash state)
  const legacyDir = path.join(projectPath, 'prd');
  const canonicalDir = path.join(projectPath, 'prds');
  await fs.mkdir(legacyDir, { recursive: true });
  await fs.mkdir(canonicalDir, { recursive: true });
  
  await fs.writeFile(path.join(legacyDir, 'spec.md'), '# Spec Title Legacy\n', 'utf8');
  await fs.writeFile(path.join(canonicalDir, 'spec.md'), '# Spec Title Canonical\n', 'utf8');

  // Create a manifest with both legacy and canonical entries
  const manifestData = [
    {
      id: 'prd/spec.md',
      artifactType: 'prd',
      title: 'Spec Title Legacy',
      projectId: tempProjectId,
      path: 'prd/spec.md',
      created: '2026-01-01T00:00:00.000Z',
      customMetadata: 'legacyValue'
    },
    {
      id: 'prds/spec.md',
      artifactType: 'prd',
      title: 'Spec Title Canonical',
      projectId: tempProjectId,
      path: 'prds/spec.md',
      created: '2026-06-01T00:00:00.000Z',
      activeMetadata: 'canonicalValue'
    }
  ];
  await fs.writeFile(
    path.join(projectPath, '.metadata', 'artifacts.json'),
    JSON.stringify(manifestData, null, 2),
    'utf8'
  );

  // Reconcile
  await reconcileArtifacts(tempProjectId);

  // Verify canonical file content was not overwritten by the legacy duplicate
  const canonicalContent = await fs.readFile(path.join(canonicalDir, 'spec.md'), 'utf8');
  assert.strictEqual(canonicalContent, '# Spec Title Canonical\n');

  // Verify manifest was merged and deduplicated
  const rawManifest = await fs.readFile(path.join(projectPath, '.metadata', 'artifacts.json'), 'utf8');
  const manifest = JSON.parse(rawManifest);

  // Length should be 1 (legacy removed/merged)
  assert.strictEqual(manifest.length, 1);
  
  const merged = manifest[0];
  assert.strictEqual(merged.id, 'prds/spec.md');
  assert.strictEqual(merged.path, 'prds/spec.md');
  // Existing/canonical fields take priority
  assert.strictEqual(merged.title, 'Spec Title Canonical');
  assert.strictEqual(merged.activeMetadata, 'canonicalValue');
  // Legacy specific fields should be merged in
  assert.strictEqual(merged.customMetadata, 'legacyValue');
});

test('Artifact Service - convertFileToArtifact successfully converts Markdown files with duplicate handling', async () => {
  // 1. Create a markdown file in the project
  const dummyFile = 'dummy.md';
  const dummyContent = '# Dummy Content\nThis is a dummy markdown file.';
  await fs.writeFile(path.join(projectPath, dummyFile), dummyContent, 'utf8');

  // 2. Setup an unmanifested target file to check duplicate resolution
  const targetDir = path.join(projectPath, 'roadmaps');
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(targetDir, 'dummy.md'), 'unmanifested-content', 'utf8');

  // 3. Convert file
  const artifact = await convertFileToArtifact(tempProjectId, dummyFile, 'roadmap');

  // 4. Verify rename generated a unique ID/path
  assert.strictEqual(artifact.id, 'roadmaps/dummy-2.md');
  assert.strictEqual(artifact.path, 'roadmaps/dummy-2.md');

  // 5. Verify the files are intact
  const originalUnmanifested = await fs.readFile(path.join(targetDir, 'dummy.md'), 'utf8');
  assert.strictEqual(originalUnmanifested, 'unmanifested-content');

  const convertedContent = await fs.readFile(path.join(targetDir, 'dummy-2.md'), 'utf8');
  assert.strictEqual(convertedContent, dummyContent);

  // 6. Verify sidecar is written safely
  const sidecarPath = path.join(targetDir, 'dummy-2.json');
  const sidecarExists = await fs.access(sidecarPath).then(() => true).catch(() => false);
  assert.ok(sidecarExists, 'Sidecar file should exist');
});

test('Artifact Service - convertFileToArtifact rejects non-Markdown files', async () => {
  // 1. Create a non-markdown file in the project
  const dummyFile = 'dummy.png';
  const dummyContent = 'dummy-binary-data';
  await fs.writeFile(path.join(projectPath, dummyFile), dummyContent, 'utf8');

  // 2. Attempt conversion and expect failure
  await assert.rejects(
    async () => await convertFileToArtifact(tempProjectId, dummyFile, 'roadmap'),
    { message: /only markdown \(\.md\) files are supported/i }
  );
});

test('Artifact Service - reconcile corrects mismatched artifactType based on path', async () => {
  // Create a presentations directory and write a file
  const presentationsDir = path.join(projectPath, 'presentations');
  await fs.mkdir(presentationsDir, { recursive: true });
  await fs.writeFile(path.join(presentationsDir, 'test-presentation.md'), '# Test Presentation\n', 'utf8');

  // Create a manifest entry with incorrect type
  const manifestData = [
    {
      id: 'presentations/test-presentation.md',
      artifactType: 'roadmap', // Incorrect type!
      title: 'Test Presentation',
      projectId: tempProjectId,
      path: 'presentations/test-presentation.md',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    }
  ];
  await fs.writeFile(
    path.join(projectPath, '.metadata', 'artifacts.json'),
    JSON.stringify(manifestData, null, 2),
    'utf8'
  );

  // Write a sidecar with the incorrect type
  const sidecarData = {
    id: 'presentations/test-presentation.md',
    artifactType: 'roadmap', // Incorrect type!
    title: 'Test Presentation',
    projectId: tempProjectId,
    path: 'presentations/test-presentation.md',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    silentLearner: {
      confidence: 0.5
    }
  };
  await fs.writeFile(
    path.join(presentationsDir, 'test-presentation.json'),
    JSON.stringify(sidecarData, null, 2),
    'utf8'
  );

  // Reconcile
  await reconcileArtifacts(tempProjectId);

  // Verify manifest type was corrected to 'presentation'
  const rawManifest = await fs.readFile(path.join(projectPath, '.metadata', 'artifacts.json'), 'utf8');
  const manifest = JSON.parse(rawManifest);
  assert.strictEqual(manifest.length, 1);
  assert.strictEqual(manifest[0].artifactType, 'presentation');

  // Verify sidecar type was also corrected
  const rawSidecar = await fs.readFile(path.join(presentationsDir, 'test-presentation.json'), 'utf8');
  const sidecar = JSON.parse(rawSidecar);
  assert.strictEqual(sidecar.artifactType, 'presentation');
});

test('Artifact Service - handleFileRename renames and updates sidecar and manifest', async () => {
  const oldName = 'old-folder/test-doc.md';
  const newName = 'new-folder/test-doc-renamed.md';
  const oldSidecar = 'old-folder/test-doc.json';
  const newSidecar = 'new-folder/test-doc-renamed.json';

  // 1. Create original file and sidecar on disk
  await fs.mkdir(path.join(projectPath, 'old-folder'), { recursive: true });
  await fs.writeFile(path.join(projectPath, oldName), '# Test Doc\nSome content', 'utf8');

  const sidecarData = {
    id: oldName,
    artifactType: 'document',
    title: 'Test Doc',
    resource: oldName,
    projectId: tempProjectId,
    customField: 'keep-me'
  };
  await fs.writeFile(path.join(projectPath, oldSidecar), JSON.stringify(sidecarData, null, 2), 'utf8');

  // 2. Add artifact to manifest
  const manifestData = [
    {
      id: oldName,
      artifactType: 'roadmap',
      title: 'Test Doc',
      projectId: tempProjectId,
      path: oldName,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    }
  ];
  await fs.writeFile(
    path.join(projectPath, '.metadata', 'artifacts.json'),
    JSON.stringify(manifestData, null, 2),
    'utf8'
  );

  // 3. Perform handleFileRename (simulating filesystem rename completed)
  await fs.mkdir(path.join(projectPath, 'new-folder'), { recursive: true });
  await fs.rename(path.join(projectPath, oldName), path.join(projectPath, newName));

  await handleFileRename(tempProjectId, oldName, newName);

  // 4. Verify sidecar was renamed and updated
  const sidecarExists = await fs.access(path.join(projectPath, newSidecar)).then(() => true).catch(() => false);
  assert.ok(sidecarExists, 'New sidecar should exist');
  
  const oldSidecarExists = await fs.access(path.join(projectPath, oldSidecar)).then(() => true).catch(() => false);
  assert.ok(!oldSidecarExists, 'Old sidecar should be deleted');

  const updatedSidecar = JSON.parse(await fs.readFile(path.join(projectPath, newSidecar), 'utf8'));
  assert.strictEqual(updatedSidecar.id, newName);
  assert.strictEqual(updatedSidecar.resource, newName);
  assert.strictEqual(updatedSidecar.customField, 'keep-me');

  // 5. Verify manifest entry was updated
  const rawManifest = await fs.readFile(path.join(projectPath, '.metadata', 'artifacts.json'), 'utf8');
  const manifest = JSON.parse(rawManifest);
  assert.strictEqual(manifest.length, 1);
  assert.strictEqual(manifest[0].id, newName);
  assert.strictEqual(manifest[0].path, newName);
});

test('Artifact Service - convertFileToArtifact moves and updates existing sidecar', async () => {
  const dummyFile = 'dummy-convert.md';
  const dummySidecar = 'dummy-convert.json';
  const dummyContent = '# Converted Content\nThis is converted.';

  // 1. Create file and its sidecar
  await fs.writeFile(path.join(projectPath, dummyFile), dummyContent, 'utf8');
  
  const originalSidecarData = {
    id: dummyFile,
    artifactType: 'document',
    title: 'Dummy Title',
    resource: dummyFile,
    projectId: tempProjectId,
    insights: [{ id: 'insight-1', content: 'test-insight' }]
  };
  await fs.writeFile(path.join(projectPath, dummySidecar), JSON.stringify(originalSidecarData, null, 2), 'utf8');

  // 2. Clear manifest
  await fs.writeFile(
    path.join(projectPath, '.metadata', 'artifacts.json'),
    JSON.stringify([], null, 2),
    'utf8'
  );

  // 3. Convert file to roadmap
  const artifact = await convertFileToArtifact(tempProjectId, dummyFile, 'roadmap');

  // 4. Verify sidecar was moved to roadmaps/dummy-convert.json and updated
  const targetDir = path.join(projectPath, 'roadmaps');
  const newSidecarPath = path.join(targetDir, 'dummy-convert.json');
  
  const sidecarExists = await fs.access(newSidecarPath).then(() => true).catch(() => false);
  assert.ok(sidecarExists, 'Sidecar should have moved to roadmaps/');

  const oldSidecarExists = await fs.access(path.join(projectPath, dummySidecar)).then(() => true).catch(() => false);
  assert.ok(!oldSidecarExists, 'Old sidecar should be gone');

  const sidecar = JSON.parse(await fs.readFile(newSidecarPath, 'utf8'));
  assert.strictEqual(sidecar.id, 'roadmaps/dummy-convert.md');
  assert.strictEqual(sidecar.artifactType, 'roadmap');
  assert.strictEqual(sidecar.resource, 'roadmaps/dummy-convert.md');
  assert.deepStrictEqual(sidecar.insights, [{ id: 'insight-1', content: 'test-insight' }]);
});




