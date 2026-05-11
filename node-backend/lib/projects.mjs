import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getProjectsDir } from './paths.mjs';

async function fileExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
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
  const projectEntries = entries.filter(e => e.isDirectory());

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
    
    projects.push(...results.filter(p => p !== null));
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
        return mapProject(projectDir, metadata);
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
  return project;
}

export async function getProjectFiles(projectId) {
  const project = await getProjectById(projectId);
  const entries = await fs.readdir(project.path, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
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
  return mapProject(projectDir, metadata);
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
