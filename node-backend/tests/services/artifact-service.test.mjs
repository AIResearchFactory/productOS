import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createArtifact, getArtifact, deleteArtifact, reconcileArtifacts, convertFileToArtifact } from '../../../node-backend/lib/artifacts.mjs';
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

test('Artifact Service - convertFileToArtifact safe conversion of non-Markdown files', async () => {
  // 1. Create a non-markdown file in the project
  const dummyFile = 'dummy.png';
  const dummyContent = 'dummy-binary-data';
  await fs.writeFile(path.join(projectPath, dummyFile), dummyContent, 'utf8');

  // 2. Setup an unmanifested target file to check duplicate resolution
  const targetDir = path.join(projectPath, 'roadmaps');
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(targetDir, 'dummy.png'), 'unmanifested-content', 'utf8');

  // 3. Convert file
  const artifact = await convertFileToArtifact(tempProjectId, dummyFile, 'roadmap');

  // 4. Verify rename generated a unique ID/path
  assert.strictEqual(artifact.id, 'roadmaps/dummy-2.png');
  assert.strictEqual(artifact.path, 'roadmaps/dummy-2.png');

  // 5. Verify the files are intact
  const originalUnmanifested = await fs.readFile(path.join(targetDir, 'dummy.png'), 'utf8');
  assert.strictEqual(originalUnmanifested, 'unmanifested-content');

  const convertedContent = await fs.readFile(path.join(targetDir, 'dummy-2.png'), 'utf8');
  assert.strictEqual(convertedContent, dummyContent);

  // 6. Verify sidecar is written safely and doesn't overwrite the converted file itself
  const sidecarPath = path.join(targetDir, 'dummy-2.json');
  const sidecarExists = await fs.access(sidecarPath).then(() => true).catch(() => false);
  assert.ok(sidecarExists, 'Sidecar file should exist');

  const sidecarData = JSON.parse(await fs.readFile(sidecarPath, 'utf8'));
  assert.strictEqual(sidecarData.id, 'roadmaps/dummy-2.png');
  assert.strictEqual(sidecarData.artifactType, 'roadmap');
});

