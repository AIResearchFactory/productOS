import fs from 'fs';
import path from 'path';
import { getProjectsDir } from './paths.js';

/**
 * Port of Rust ProjectService.
 */

/**
 * Validate a project ID used for filesystem path joins.
 * Allowed: ASCII letters, numbers, hyphen and underscore.
 */
export function validateProjectId(projectId) {
  if (!projectId || projectId.trim() === '') {
    throw new Error('Project ID cannot be empty');
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) {
    throw new Error('Invalid project ID format');
  }
}

/**
 * Resolve project ID to an absolute path within the projects directory.
 */
export function resolveProjectPath(projectId) {
  validateProjectId(projectId);
  const projectsPath = getProjectsDir();
  const absoluteBase = path.resolve(projectsPath);
  const absoluteProject = path.resolve(absoluteBase, projectId);

  // Path traversal check
  if (!absoluteProject.startsWith(absoluteBase)) {
    throw new Error('Project path escapes projects directory');
  }
  return absoluteProject;
}

/**
 * Load a project from its directory.
 */
export function loadProject(projectPath) {
  const metadataPath = path.join(projectPath, '.metadata', 'project.json');
  if (!fs.existsSync(metadataPath)) {
    throw new Error(`Project metadata not found at ${metadataPath}`);
  }

  const content = fs.readFileSync(metadataPath, 'utf-8');
  const project = JSON.parse(content);
  project.path = projectPath;

  // Ensure required fields
  if (!project.id) project.id = path.basename(projectPath);
  if (!project.name) project.name = project.id;
  if (!project.goal) project.goal = '';
  if (!project.skills) project.skills = [];
  if (!project.created_at && project.created) project.created_at = project.created;

  return project;
}

/**
 * Load a project by its ID.
 */
export function loadProjectById(projectId) {
  const projectPath = resolveProjectPath(projectId);
  return loadProject(projectPath);
}

/**
 * Discover all valid projects in the projects directory.
 */
export function discoverProjects() {
  const projectsPath = getProjectsDir();
  fs.mkdirSync(projectsPath, { recursive: true });

  const projects = [];
  for (const entry of fs.readdirSync(projectsPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const projectPath = path.join(projectsPath, entry.name);
    if (isValidProject(projectPath)) {
      try {
        projects.push(loadProject(projectPath));
      } catch (e) {
        console.error(`[project] Failed to load project at ${projectPath}: ${e.message}`);
      }
    }
  }

  return projects;
}

/**
 * Check if a directory is a valid project.
 */
export function isValidProject(projectPath) {
  const metadataPath = path.join(projectPath, '.metadata', 'project.json');
  if (!fs.existsSync(metadataPath)) return false;

  try {
    const project = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    return !!project.id && !!project.name;
  } catch {
    return false;
  }
}

/**
 * Create a new project.
 */
export function createProject(name, goal, skills = []) {
  const projectsPath = getProjectsDir();
  fs.mkdirSync(projectsPath, { recursive: true });

  // Generate project ID from name
  const projectId = name
    .toLowerCase()
    .replace(/ /g, '-')
    .replace(/[^a-z0-9_-]/g, '');

  const projectPath = path.join(projectsPath, projectId);

  if (fs.existsSync(projectPath)) {
    throw new Error(`Project directory already exists at ${projectPath}`);
  }

  // Create directory structure
  fs.mkdirSync(path.join(projectPath, '.metadata'), { recursive: true });

  const now = new Date().toISOString();
  const project = {
    id: projectId,
    name,
    goal: goal || '',
    skills,
    created: now,
    created_at: now
  };

  // Save metadata
  fs.writeFileSync(
    path.join(projectPath, '.metadata', 'project.json'),
    JSON.stringify(project, null, 2),
    'utf-8'
  );

  // Create initial README.md
  fs.writeFileSync(
    path.join(projectPath, 'README.md'),
    `# ${name}\n\n## Goal\n${goal}\n\nWelcome to your new research project!\n`,
    'utf-8'
  );

  // Create default project settings
  const defaultSettings = {
    name: null,
    goal: null,
    custom_prompt: null,
    preferred_skills: [],
    auto_save: true,
    encryption_enabled: true,
    personalization_rules: null,
    brand_settings: null
  };
  fs.writeFileSync(
    path.join(projectPath, '.metadata', 'settings.json'),
    JSON.stringify(defaultSettings, null, 2),
    'utf-8'
  );

  return { ...project, path: projectPath };
}

/**
 * Delete a project.
 */
export function deleteProject(projectId) {
  const projectPath = resolveProjectPath(projectId);
  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path not found: ${projectPath}`);
  }
  fs.rmSync(projectPath, { recursive: true, force: true });
}

/**
 * Update project metadata.
 */
export function updateProjectMetadata(projectId, name, goal) {
  const project = loadProjectById(projectId);
  if (name !== undefined) project.name = name;
  if (goal !== undefined) project.goal = goal;

  const metadataPath = path.join(resolveProjectPath(projectId), '.metadata', 'project.json');
  const { path: _path, ...projectData } = project;
  fs.writeFileSync(metadataPath, JSON.stringify(projectData, null, 2), 'utf-8');
}

/**
 * List all files in a project (excluding hidden metadata).
 */
export function listProjectFiles(projectId) {
  const trimmedId = (projectId || '').trim();

  // Return empty for draft projects
  if (trimmedId === 'new-project' || trimmedId.startsWith('draft-')) return [];

  let projectPath;
  try {
    projectPath = resolveProjectPath(trimmedId);
  } catch {
    return [];
  }

  if (!fs.existsSync(projectPath)) {
    // Try to find by scanning
    const projects = discoverProjects();
    const found = projects.find(p => p.id === trimmedId);
    if (!found) return [];
    projectPath = found.path;
  }

  const relevantExtensions = new Set([
    'md', 'txt', 'csv', 'rs', 'js', 'ts', 'py', 'go', 'c', 'cpp', 'java', 'yaml', 'yml'
  ]);

  const artifactDirs = new Set([
    'roadmaps', 'product-visions', 'one-pagers', 'prds', 'initiatives',
    'competitive-research', 'user-stories', 'insights', 'requirements',
    'presentations', 'artifacts', 'assets', '.assets', 'asset', '.asset',
    'prfaq', 'pr-faq'
  ]);

  const files = [];

  function walk(dir, relBase) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      const name = entry.name;
      const nameLower = name.toLowerCase();

      // Skip hidden files/dirs
      if (name.startsWith('.')) continue;

      const fullPath = path.join(dir, name);
      const relPath = relBase ? `${relBase}/${name}` : name;

      if (entry.isDirectory()) {
        // Skip artifact directories
        if (artifactDirs.has(nameLower)) continue;
        walk(fullPath, relPath);
      } else {
        const ext = path.extname(name).slice(1).toLowerCase();
        if (relevantExtensions.has(ext)) {
          files.push(relPath);
        }
      }
    }
  }

  walk(projectPath, '');
  files.sort();
  return files;
}
