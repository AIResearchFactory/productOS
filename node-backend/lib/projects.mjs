import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getProjectsDir, getContextIndexPath, getContextCompletionMarkerPath } from './paths.mjs';
import { generateContextDirectory } from './context-generator.mjs';

async function fileExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function ensureProjectContextDir(project) {
  if (!project || !project.path) return;
  const completionMarker = getContextCompletionMarkerPath(project.path);
  if (!await fileExists(completionMarker)) {
    try {
      await generateContextDirectory(project.id, null, project);
    } catch (err) {
      console.warn(`[projects] Failed to generate context directory for ${project.id}:`, err.message);
    }
  }
}

function mapProject(projectDir, metadata) {
  return {
    id: metadata.id,
    name: metadata.name,
    goal: metadata.goal,
    skills: Array.isArray(metadata.skills) ? metadata.skills : [],
    created_at: metadata.created,
    path: projectDir,
  };
}

function slugifyProjectId(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `project-${randomUUID().slice(0, 8)}`;
}

async function writeProjectMetadata(projectDir, metadata) {
  const metadataDir = path.join(projectDir, '.metadata');
  await fs.mkdir(metadataDir, { recursive: true });
  await fs.writeFile(path.join(metadataDir, 'project.json'), JSON.stringify(metadata, null, 2), 'utf8');
}

async function readMetadataWithRetry(metadataPath, retries = 3, delay = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      const content = await fs.readFile(metadataPath, 'utf8');
      return JSON.parse(content);
    } catch (err) {
      if (i === retries - 1) throw err;
      // If it's a timeout or busy error, wait and retry
      if (err.code === 'ETIMEDOUT' || err.code === 'EBUSY' || err.code === 'EAGAIN') {
        console.log(`[projects] Retrying metadata read (${i + 1}/${retries}) for ${metadataPath} due to ${err.code}`);
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        continue;
      }
      throw err;
    }
  }
}

export async function listProjects() {
  const projectsDir = await getProjectsDir();
  console.log(`[projects] Listing projects in: ${projectsDir}`);
  
  try {
    await fs.mkdir(projectsDir, { recursive: true });
  } catch (err) {
    console.error(`[projects] Failed to ensure projects directory: ${err.message}`);
    return [];
  }
  
  let entries = [];
  try {
    entries = await fs.readdir(projectsDir, { withFileTypes: true });
  } catch (err) {
    console.error(`[projects] Failed to read projects directory: ${err.message}`);
    return [];
  }
  
  const projects = [];
  // Process in small batches to avoid overwhelming cloud storage drivers (Box/OneDrive)
  const BATCH_SIZE = 3;
  const projectEntries = entries.filter(e => e.isDirectory() || e.isSymbolicLink());

  for (let i = 0; i < projectEntries.length; i += BATCH_SIZE) {
    const batch = projectEntries.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(async (entry) => {
      const projectDir = path.join(projectsDir, entry.name);
      const metadataPath = path.join(projectDir, '.metadata', 'project.json');
      
      try {
        // First check if metadata exists (this might also trigger hydration)
        if (!await fileExists(metadataPath)) return null;
        
        const metadata = await readMetadataWithRetry(metadataPath);
        return mapProject(projectDir, metadata);
      } catch (err) {
        console.warn(`[projects] Failed to load metadata for ${entry.name}:`, err.message);
        return null;
      }
    }));
    
    const validProjects = results.filter(p => p !== null);
    await Promise.all(validProjects.map(p => ensureProjectContextDir(p)));
    projects.push(...validProjects);
  }

  console.log(`[projects] Found ${projects.length} valid projects`);
  projects.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  return projects;
}

export async function getProjectById(projectId) {
  const projectsDir = await getProjectsDir();
  const projectDir = path.join(projectsDir, projectId);
  const metadataPath = path.join(projectDir, '.metadata', 'project.json');
  
  // Fast path: Try to load directly by directory name
  if (await fileExists(metadataPath)) {
    try {
      const metadata = await readMetadataWithRetry(metadataPath);
      if (metadata && metadata.id === projectId) {
        const project = mapProject(projectDir, metadata);
        await ensureProjectContextDir(project);
        return project;
      }
    } catch (err) {
      console.warn(`[projects] Fast path failed for project ${projectId}:`, err);
    }
  }

  // Fallback if folder name !== projectId
  let projects = await listProjects();
  let project = projects.find((item) => item.id === projectId);
  
  if (!project) {
    // Retry once after a small delay to handle FS race conditions in E2E tests
    await new Promise(resolve => setTimeout(resolve, 500));
    projects = await listProjects();
    project = projects.find((item) => item.id === projectId);
  }

  if (!project) {
    const error = new Error(`Project not found: ${projectId}`);
    error.statusCode = 404;
    throw error;
  }
  await ensureProjectContextDir(project);
  return project;
}

export async function getProjectFiles(projectId, options = {}) {
  const project = await getProjectById(projectId);
  const filesList = [];
  const allRelativePaths = new Set();

  const ignoreDirs = new Set([
    '.git',
    '.metadata',
    '.workflows',
    '.gemini',
    'node_modules',
    // artifact folders
    'roadmaps',
    'product-visions',
    'one-pagers',
    'prds',
    'initiatives',
    'competitive-research',
    'user-stories',
    'insights',
    'presentations',
    'pr-faqs',
    'artifacts',
    'chats'
  ]);

  const ignoreFiles = new Set([
    'research_log.md',
    'log.md',
    'index.md',
    'learning_log.md'
  ]);

  const scan = async (dirPath) => {
    let entries = [];
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch (err) {
      console.warn(`[projects] Failed to readdir at ${dirPath}:`, err.message);
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      const fullPath = path.join(dirPath, entry.name);
      const relPath = path.relative(project.path, fullPath).replace(/\\/g, '/');
      const topDir = relPath.split('/')[0].toLowerCase();

      if (entry.isDirectory()) {
        if (ignoreDirs.has(topDir)) continue;
        await scan(fullPath);
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        if (ignoreDirs.has(topDir)) continue;
        if (ignoreFiles.has(entry.name.toLowerCase())) continue;

        allRelativePaths.add(relPath);
        filesList.push({
          name: relPath,
          fullPath
        });
      }
    }
  };

  try {
    await scan(project.path);
  } catch (err) {
    console.error(`[projects] Failed to scan project files for ${projectId}:`, err);
    return [];
  }

  // Filter out JSON sidecars
  const filteredFiles = filesList.filter(file => {
    if (file.name.endsWith('.json')) {
      const mdPath = file.name.slice(0, -5) + '.md';
      if (allRelativePaths.has(mdPath)) {
        return false;
      }
    }
    return true;
  });

  if (options.sort === 'mtime') {
    const withMtime = await Promise.all(
      filteredFiles.map(async (file) => {
        try {
          const stat = await fs.stat(file.fullPath);
          return { name: file.name, mtime: stat.mtimeMs };
        } catch {
          return { name: file.name, mtime: 0 };
        }
      })
    );
    return withMtime
      .sort((a, b) => b.mtime - a.mtime)
      .map((item) => item.name);
  }

  return filteredFiles
    .map((file) => file.name)
    .sort((a, b) => a.localeCompare(b));
}

export async function createProject(name, goal = '', skills = []) {
  const projectsDir = await getProjectsDir();
  await fs.mkdir(projectsDir, { recursive: true });

  const baseId = slugifyProjectId(name);
  let projectId = baseId;
  let suffix = 2;
  while (await fileExists(path.join(projectsDir, projectId, '.metadata', 'project.json'))) {
    projectId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  const projectDir = path.join(projectsDir, projectId);
  const metadata = {
    id: projectId,
    name,
    goal,
    skills: Array.isArray(skills) ? skills : [],
    created: new Date().toISOString(),
  };

  await fs.mkdir(projectDir, { recursive: true });
  await writeProjectMetadata(projectDir, metadata);
  const project = mapProject(projectDir, metadata);
  await ensureProjectContextDir(project);
  return project;
}

export async function renameProject(projectId, newName) {
  const project = await getProjectById(projectId);
  const metadataPath = path.join(project.path, '.metadata', 'project.json');
  const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
  metadata.name = newName;
  await writeProjectMetadata(project.path, metadata);
}

export async function deleteProject(projectId) {
  const project = await getProjectById(projectId);
  await fs.rm(project.path, { recursive: true, force: true });
}

export async function getProjectBrandConfig(projectId) {
  const project = await getProjectById(projectId);
  const metadataPath = path.join(project.path, '.metadata', 'project.json');
  try {
    const metadata = await readMetadataWithRetry(metadataPath);
    return metadata.brandConfig || null;
  } catch {
    return null;
  }
}

export async function updateProjectBrandConfig(projectId, brandConfig) {
  const project = await getProjectById(projectId);
  const metadataPath = path.join(project.path, '.metadata', 'project.json');
  const metadata = await readMetadataWithRetry(metadataPath);
  metadata.brandConfig = brandConfig;
  await writeProjectMetadata(project.path, metadata);
  return metadata.brandConfig;
}

export async function saveProjectTemplate(projectId, fileBuffer) {
  const project = await getProjectById(projectId);
  const templatePath = path.join(project.path, '.metadata', 'sample_deck.pptx');
  await fs.writeFile(templatePath, fileBuffer);
}

export async function getProjectTemplate(projectId) {
  const project = await getProjectById(projectId);
  const templatePath = path.join(project.path, '.metadata', 'sample_deck.pptx');
  if (await fileExists(templatePath)) {
    return await fs.readFile(templatePath);
  }
  return null;
}

