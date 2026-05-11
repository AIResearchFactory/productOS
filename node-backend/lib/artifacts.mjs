import fs from 'node:fs/promises';
import path from 'node:path';
import { getProjectById } from './projects.mjs';
import { FileService } from './files.mjs';

const TYPE_DIRS = {
  roadmap: 'roadmaps',
  product_vision: 'product-visions',
  one_pager: 'one-pagers',
  prd: 'prds',
  initiative: 'initiatives',
  competitive_research: 'competitive-research',
  user_story: 'user-stories',
  insight: 'insights',
  presentation: 'presentations',
  pr_faq: 'pr-faqs',
};

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `artifact-${Date.now()}`;
}

async function getManifestPath(projectId) {
  const project = await getProjectById(projectId);
  const metadataDir = path.join(project.path, '.metadata');
  await fs.mkdir(metadataDir, { recursive: true });
  return path.join(metadataDir, 'artifacts.json');
}

async function readManifest(projectId) {
  const manifestPath = await getManifestPath(projectId);
  try {
    return JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      // Reconstruct manifest by scanning folders
      const project = await getProjectById(projectId);
      const artifacts = [];
      for (const [type, folder] of Object.entries(TYPE_DIRS)) {
        // Try both lowercase and original/camelCase names
        const possibleFolders = [folder, folder.toUpperCase(), folder.charAt(0).toUpperCase() + folder.slice(1)];
        if (type === 'prd') possibleFolders.push('PRDs');
        if (type === 'initiative') possibleFolders.push('Initiatives');

        for (const f of possibleFolders) {
          const dir = path.join(project.path, f);
          try {
            const files = await fs.readdir(dir);
            for (const file of files) {
              if (!file.endsWith('.md')) continue;
              const id = path.parse(file).name;
              artifacts.push({
                id,
                artifactType: type,
                title: id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                projectId,
                path: `${f}/${file}`,
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
              });
            }
            break; // Found one folder, move to next type
          } catch {}
        }
      }
      return artifacts;
    }
    throw error;
  }
}

async function writeManifest(projectId, artifacts) {
  const manifestPath = await getManifestPath(projectId);
  await fs.writeFile(manifestPath, JSON.stringify(artifacts, null, 2), 'utf8');
}

async function getArtifactFilePath(projectId, artifactType, artifactId) {
  const project = await getProjectById(projectId);
  const folder = TYPE_DIRS[artifactType] || 'artifacts';
  const dir = path.join(project.path, folder);
  await fs.mkdir(dir, { recursive: true });
  return path.join(dir, `${artifactId}.md`);
}

export async function listArtifacts(projectId) {
  const artifacts = await readManifest(projectId);
  artifacts.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  return artifacts;
}

export async function createArtifact(projectId, artifactType, title) {
  const artifacts = await readManifest(projectId);
  const baseId = slugify(title);
  let id = baseId;
  let i = 2;
  while (artifacts.some((artifact) => artifact.id === id)) {
    id = `${baseId}-${i++}`;
  }
  const now = new Date().toISOString();
  const folder = TYPE_DIRS[artifactType] || 'artifacts';
  const artifact = {
    id,
    artifactType,
    title,
    content: `# ${title}\n`,
    projectId: projectId,
    sourceRefs: [],
    confidence: undefined,
    created: now,
    updated: now,
    metadata: {},
    path: `${folder}/${id}.md`,
  };
  artifacts.push(artifact);
  await writeManifest(projectId, artifacts);
  await fs.writeFile(await getArtifactFilePath(projectId, artifactType, id), artifact.content, 'utf8');
  return artifact;
}

export async function getArtifact(projectId, artifactId) {
  const artifacts = await readManifest(projectId);
  const artifact = artifacts.find((item) => item.id === artifactId);
  if (!artifact) {
    const error = new Error(`Artifact not found: ${artifactId}`);
    error.statusCode = 404;
    throw error;
  }
  return artifact;
}

export async function saveArtifact(artifact) {
  const artifacts = await readManifest(artifact.projectId);
  const index = artifacts.findIndex((item) => item.id === artifact.id);
  const next = { ...artifact, updated: new Date().toISOString() };
  if (index >= 0) artifacts[index] = next;
  else artifacts.push(next);
  await writeManifest(artifact.projectId, artifacts);
  await fs.writeFile(await getArtifactFilePath(artifact.projectId, artifact.artifactType, artifact.id), next.content || '', 'utf8');
}

export async function deleteArtifact(projectId, artifactId) {
  const artifacts = await readManifest(projectId);
  const artifact = artifacts.find((item) => item.id === artifactId);
  await writeManifest(projectId, artifacts.filter((item) => item.id !== artifactId));
  if (artifact) {
    await fs.rm(await getArtifactFilePath(projectId, artifact.artifactType, artifact.id), { force: true });
  }
}

export async function updateArtifactMetadata(projectId, artifactId, updates) {
  const artifacts = await readManifest(projectId);
  const index = artifacts.findIndex((item) => item.id === artifactId);
  if (index === -1) {
    const error = new Error(`Artifact not found: ${artifactId}`);
    error.statusCode = 404;
    throw error;
  }
  
  // Only update fields that are actually provided (not undefined)
  const cleanUpdates = Object.fromEntries(
    Object.entries(updates).filter(([_, v]) => v !== undefined)
  );
  
  artifacts[index] = { ...artifacts[index], ...cleanUpdates, updated: new Date().toISOString() };
  await writeManifest(projectId, artifacts);
}

export async function importArtifact(projectId, artifactType, sourcePath) {
    // 1. Import as markdown file first
    const fileName = await FileService.importDocument(projectId, sourcePath);
    const project = await getProjectById(projectId);
    const fullPath = path.join(project.path, fileName);
    
    // 2. Read content to extract title
    const content = await fs.readFile(fullPath, 'utf8');
    const titleLine = content.split('\n').find(l => l.startsWith('# '));
    const title = titleLine ? titleLine.replace('# ', '').trim() : path.parse(sourcePath).name;
    
    // 3. Create artifact
    const artifact = await createArtifact(projectId, artifactType, title);
    artifact.content = content;
    await saveArtifact(artifact);
    
    // 4. Cleanup temporary file if it was created in the root
    if (fileName !== artifact.path) {
        await fs.rm(fullPath, { force: true });
    }
    
    return artifact;
}

export async function exportArtifact(projectId, artifactId, artifactType, targetPath, exportFormat) {
    const artifact = await getArtifact(projectId, artifactId);
    // Artifact path is already relative to project path
    await FileService.exportDocument(projectId, artifact.path, targetPath, exportFormat);
}

export async function migrateArtifacts(projectId) {
    // Basic migration: ensure manifest exists and matches files
    const manifest = await readManifest(projectId);
    // ... logic to scan directories and add missing files to manifest ...
    return manifest.length;
}
