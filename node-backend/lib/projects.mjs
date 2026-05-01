import fs from 'node:fs/promises';
import path from 'node:path';
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
  const projects = await listProjects();
  const project = projects.find((item) => item.id === projectId);
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
