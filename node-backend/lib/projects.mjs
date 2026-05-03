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

export async function listProjects() {
  const projectsDir = await getProjectsDir();
  await fs.mkdir(projectsDir, { recursive: true });
  const entries = await fs.readdir(projectsDir, { withFileTypes: true });
  const projects = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const projectDir = path.join(projectsDir, entry.name);
    const metadataPath = path.join(projectDir, '.metadata', 'project.json');
    if (!await fileExists(metadataPath)) continue;

    try {
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
      projects.push(mapProject(projectDir, metadata));
    } catch {
      // Skip malformed projects in the prototype backend.
    }
  }

  projects.sort((a, b) => a.name.localeCompare(b.name));
  return projects;
}

export async function getProjectById(projectId) {
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
