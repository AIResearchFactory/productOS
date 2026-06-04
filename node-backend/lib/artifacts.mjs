import fs from 'node:fs/promises';
import path from 'node:path';
import { getProjectById } from './projects.mjs';
import { FileService } from './files.mjs';
import { safeJoin } from './paths.mjs';

export const TYPE_DIRS = {
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

export function normalizeArtifactFolder(folderName) {
  const lower = folderName.toLowerCase();
  // Map common legacy aliases and normalize case
  const aliasMap = {
    'prd': 'prds',
    'prds': 'prds',
    'initiative': 'initiatives',
    'initiatives': 'initiatives',
    'roadmap': 'roadmaps',
    'roadmaps': 'roadmaps',
    'product-vision': 'product-visions',
    'one-pager': 'one-pagers',
    'competitive-research': 'competitive-research',
    'user-story': 'user-stories',
    'insight': 'insights',
    'presentation': 'presentations',
    'pr-faq': 'pr-faqs',
  };
  
  const target = aliasMap[lower] || lower;
  const canonicalEntry = Object.entries(TYPE_DIRS).find(([_, folder]) => 
    folder.toLowerCase() === target || folder.toLowerCase() === target + 's'
  );
  return canonicalEntry ? canonicalEntry[1] : null;
}

export function isArtifactFolder(folderName) {
  return normalizeArtifactFolder(folderName) !== null;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `artifact-${Date.now()}`;
}

async function getManifestPath(projectId) {
  const project = await getProjectById(projectId);
  const metadataDir = await safeJoin(project.path, '.metadata');
  await fs.mkdir(metadataDir, { recursive: true });
  return path.join(metadataDir, 'artifacts.json');
}

async function readManifest(projectId) {
  const manifestPath = await getManifestPath(projectId);
  try {
    const data = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    return { artifacts: data, fromFile: true };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      // Reconstruct manifest by scanning folders
      const project = await getProjectById(projectId);
      const artifacts = [];
      for (const [type, folder] of Object.entries(TYPE_DIRS)) {
        // Scan for folder and its variants
        const possibleFolders = [folder, folder.toUpperCase(), folder.charAt(0).toUpperCase() + folder.slice(1)];
        // Add more common legacy variants
        if (type === 'prd') possibleFolders.push('PRDs', 'prd');
        if (type === 'initiative') possibleFolders.push('Initiatives', 'initiative');
        if (type === 'roadmap') possibleFolders.push('Roadmaps', 'roadmap');

        for (const f of possibleFolders) {
          try {
            const dir = await safeJoin(project.path, f);
            const files = await fs.readdir(dir);
            for (const file of files) {
              if (!file.endsWith('.md')) continue;
              const relPath = `${f}/${file}`;
              const stem = path.parse(file).name;
              artifacts.push({
                id: relPath, // Use relPath as the ID
                artifactType: type,
                title: stem.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                projectId,
                path: relPath,
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
              });
            }
            break; // Found one folder, move to next type
          } catch {}
        }
      }
      return { artifacts, fromFile: false };
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
  // If artifactId is already a relative path (contains / and ends with .md)
  if (artifactId.includes('/') && artifactId.endsWith('.md')) {
    const fullPath = await safeJoin(project.path, artifactId);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    return fullPath;
  }
  // Legacy support for slug-only IDs or fallback
  const folder = TYPE_DIRS[artifactType] || 'artifacts';
  const dir = await safeJoin(project.path, folder);
  await fs.mkdir(dir, { recursive: true });
  return path.join(dir, `${artifactId}.md`);
}

export async function listArtifacts(projectId) {
  const { artifacts } = await readManifest(projectId);
  artifacts.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  return artifacts;
}

export async function createArtifact(projectId, artifactType, title) {
  const { artifacts } = await readManifest(projectId);
  const folder = TYPE_DIRS[artifactType] || 'artifacts';
  const slug = slugify(title);
  const baseId = `${folder}/${slug}.md`;
  let id = baseId;
  let i = 2;
  while (artifacts.some((artifact) => artifact.id === id || artifact.path === id)) {
    id = `${folder}/${slug}-${i++}.md`;
  }
  const now = new Date().toISOString();
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
    path: id, // id is now the relPath
  };
  artifacts.push(artifact);
  await writeManifest(projectId, artifacts);
  await fs.writeFile(await getArtifactFilePath(projectId, artifactType, id), artifact.content, 'utf8');
  return artifact;
}

export async function getArtifact(projectId, artifactId) {
  const { artifacts } = await readManifest(projectId);
  const artifact = artifacts.find((item) => item.id === artifactId);
  if (!artifact) {
    const error = new Error(`Artifact not found: ${artifactId}`);
    error.statusCode = 404;
    throw error;
  }
  return artifact;
}

export async function saveArtifact(artifact) {
  const { artifacts } = await readManifest(artifact.projectId);
  const index = artifacts.findIndex((item) => item.id === artifact.id);
  
  // Extract title from H1 if present to keep manifest in sync
  let title = artifact.title;
  if (artifact.content) {
    const match = artifact.content.match(/^#\s+(.+)$/m);
    if (match) {
      const extracted = match[1].trim();
      // Only update if it's not empty and different
      if (extracted && extracted !== title) {
        title = extracted;
      }
    }
  }

  const next = { ...artifact, title, updated: new Date().toISOString() };
  if (index >= 0) artifacts[index] = next;
  else artifacts.push(next);
  await writeManifest(artifact.projectId, artifacts);
  await fs.writeFile(await getArtifactFilePath(artifact.projectId, artifact.artifactType, artifact.id), next.content || '', 'utf8');
}

export async function deleteArtifact(projectId, artifactId) {
  const { artifacts } = await readManifest(projectId);
  const artifact = artifacts.find((item) => item.id === artifactId);
  await writeManifest(projectId, artifacts.filter((item) => item.id !== artifactId));
  if (artifact) {
    await fs.rm(await getArtifactFilePath(projectId, artifact.artifactType, artifact.id), { force: true });
  }
}

export async function updateArtifactMetadata(projectId, artifactId, updates) {
  const { artifacts } = await readManifest(projectId);
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
    return await reconcileArtifacts(projectId);
}

export async function reconcileArtifacts(projectId) {
    const project = await getProjectById(projectId);
    const { artifacts: manifest, fromFile } = await readManifest(projectId);
    let changed = !fromFile; // If we didn't load from file, we should definitely write back

    // 1. Remove artifacts whose files are missing
    let filtered = [];
    for (const a of manifest) {
        try {
            await fs.access(await safeJoin(project.path, a.path));
            filtered.push(a);
        } catch {
            console.log(`[Artifacts] Removing missing artifact from manifest: ${a.id} (${a.path})`);
            changed = true;
        }
    }

    // 2. Migrate files from legacy folders to canonical folders, and update the manifest paths/ids
    const allFolders = await fs.readdir(project.path).catch(() => []);
    for (const folderName of allFolders) {
        const canonicalFolder = normalizeArtifactFolder(folderName);
        if (!canonicalFolder || folderName === canonicalFolder) continue;

        // folderName is a legacy folder (e.g. 'prd')! Let's migrate all files inside it to canonicalFolder (e.g. 'prds')
        try {
            const legacyDir = await safeJoin(project.path, folderName);
            const canonicalDir = await safeJoin(project.path, canonicalFolder);
            const stats = await fs.stat(legacyDir);
            if (!stats.isDirectory()) continue;

            await fs.mkdir(canonicalDir, { recursive: true });
            const files = await fs.readdir(legacyDir);
            for (const file of files) {
                try {
                    const srcPath = await safeJoin(legacyDir, file);
                    const destPath = await safeJoin(canonicalDir, file);
                    
                    let renameSuccess = false;
                    let destExists = false;
                    try {
                        await fs.access(destPath);
                        destExists = true;
                    } catch {}

                    if (destExists) {
                        // Never overwrite canonical artifact content with a legacy duplicate.
                        console.log(`[Artifacts] Keeping existing canonical file ${canonicalFolder}/${file}; deduplicating manifest only`);
                        renameSuccess = true;
                    } else {
                        try {
                            // Move file only when the canonical destination does not exist.
                            await fs.rename(srcPath, destPath);
                            console.log(`[Artifacts] Migrated legacy file ${folderName}/${file} to ${canonicalFolder}/${file}`);
                            renameSuccess = true;
                        } catch (renameErr) {
                            let srcExists = true;
                            try {
                                await fs.access(srcPath);
                            } catch {
                                srcExists = false;
                            }
                            try {
                                await fs.access(destPath);
                                destExists = true;
                            } catch {}

                            if (destExists && !srcExists) {
                                renameSuccess = true;
                            }
                        }
                    }

                    if (renameSuccess) {
                        // Update manifest entry if it exists
                        const oldRelPath = `${folderName}/${file}`;
                        const newRelPath = `${canonicalFolder}/${file}`;
                        const oldIdx = filtered.findIndex(a => a.path === oldRelPath || a.id === oldRelPath);
                        if (oldIdx !== -1) {
                            const newIdx = filtered.findIndex(a => a.path === newRelPath || a.id === newRelPath);
                            if (newIdx !== -1) {
                                // Merge legacy entry metadata into the existing canonical entry
                                filtered[newIdx] = {
                                    ...filtered[oldIdx],
                                    ...filtered[newIdx],
                                    id: newRelPath,
                                    path: newRelPath
                                };
                                filtered.splice(oldIdx, 1);
                            } else {
                                filtered[oldIdx].path = newRelPath;
                                filtered[oldIdx].id = newRelPath;
                            }
                            changed = true;
                        }
                    }
                } catch (fileErr) {
                    console.error(`[Artifacts] Failed to process legacy file ${file}:`, fileErr);
                }
            }
            
            // Try to remove the empty legacy directory
            await fs.rmdir(legacyDir).catch(() => {});
        } catch (err) {
            // Ignore if directory can't be read or moved
        }
    }

    // 3. Add new files found in canonical artifact folders
    const activeFolders = await fs.readdir(project.path).catch(() => []);
    for (const folderName of activeFolders) {
        const canonicalFolder = normalizeArtifactFolder(folderName);
        // Only scan if folderName is canonical to prevent double scanning
        if (!canonicalFolder || folderName !== canonicalFolder) continue;

        const artifactType = Object.entries(TYPE_DIRS).find(([_, f]) => f === canonicalFolder)?.[0];
        if (!artifactType) continue;

        const dir = await safeJoin(project.path, folderName);
        try {
            const files = await fs.readdir(dir);
            for (const file of files) {
                if (!file.endsWith('.md')) continue;
                const relPath = `${folderName}/${file}`;
                
                if (!filtered.some(a => a.path === relPath || a.id === relPath)) {
                    const stem = path.parse(file).name;
                    console.log(`[Artifacts] Discovered new artifact file: ${relPath}`);
                    filtered.push({
                        id: relPath, // Use relPath as the ID
                        artifactType,
                        title: stem.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                        projectId,
                        path: relPath,
                        created: new Date().toISOString(),
                        updated: new Date().toISOString(),
                    });
                    changed = true;
                }
            }
        } catch (err) {
            // Folder might not be a directory or inaccessible
        }
    }

    if (changed) {
        await writeManifest(projectId, filtered);
    }
    return filtered.length;
}
