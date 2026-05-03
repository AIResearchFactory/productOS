import path from 'path';
import os from 'os';
import fs from 'fs';

/**
 * Get the app data directory (OS-specific).
 * - macOS: ~/Library/Application Support/productOS
 * - Linux: ~/.local/share/productOS
 * - Windows: %APPDATA%\productOS
 *
 * Backward compatibility: if legacy ai-researcher directory exists and productOS does not,
 * we continue using legacy path.
 */
export function getAppDataDir() {
  if (process.env.APP_DATA_DIR) {
    return process.env.APP_DATA_DIR;
  }

  const appName = 'productos';
  const legacyName = 'ai-researcher';
  let base;

  const platform = os.platform();
  if (platform === 'darwin') {
    base = path.join(os.homedir(), 'Library', 'Application Support');
  } else if (platform === 'linux') {
    base = path.join(os.homedir(), '.local', 'share');
  } else if (platform === 'win32') {
    base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  } else {
    throw new Error('Unsupported operating system');
  }

  const preferred = path.join(base, appName);
  const legacy = path.join(base, legacyName);

  // Improved legacy detection
  const preferredInitialized = fs.existsSync(preferred) &&
    (fs.existsSync(path.join(preferred, 'settings.json')) || fs.existsSync(path.join(preferred, 'projects')));

  if (!preferredInitialized && fs.existsSync(legacy)) {
    const legacyHasData = fs.existsSync(path.join(legacy, 'settings.json')) ||
      fs.existsSync(path.join(legacy, 'projects')) ||
      fs.existsSync(path.join(legacy, 'config.json'));
    if (legacyHasData) return legacy;
  }

  return preferred;
}

/**
 * Get the projects directory.
 * Returns: {APP_DATA}/projects or value from PROJECTS_DIR env var or settings.json
 */
export function getProjectsDir() {
  if (process.env.PROJECTS_DIR) {
    return process.env.PROJECTS_DIR;
  }

  // Try to read from settings.json first
  try {
    const settingsPath = getGlobalSettingsPath();
    if (fs.existsSync(settingsPath)) {
      const json = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      if (json.projectsPath && typeof json.projectsPath === 'string' && json.projectsPath !== '') {
        const projectsPath = json.projectsPath;
        // Check if a 'projects' folder exists inside the custom path
        const internalProjects = path.join(projectsPath, 'projects');
        if (fs.existsSync(internalProjects) && fs.statSync(internalProjects).isDirectory()) {
          return internalProjects;
        }
        return projectsPath;
      }
    }
  } catch { /* ignore */ }

  return path.join(getAppDataDir(), 'projects');
}

/**
 * Get the skills directory.
 */
export function getSkillsDir() {
  if (process.env.SKILLS_DIR) {
    return process.env.SKILLS_DIR;
  }

  // Try to read from settings.json
  try {
    const settingsPath = getGlobalSettingsPath();
    if (fs.existsSync(settingsPath)) {
      const json = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      if (json.projectsPath && typeof json.projectsPath === 'string' && json.projectsPath !== '') {
        const projectsPath = json.projectsPath;

        // 1. Workspace pattern: path contains both projects/ and skills/
        const internalProjects = path.join(projectsPath, 'projects');
        const internalSkills = path.join(projectsPath, 'skills');
        if (fs.existsSync(internalProjects) && fs.statSync(internalProjects).isDirectory()) {
          if (fs.existsSync(internalSkills)) return internalSkills;
        }

        // 2. Adjacent (flat project structure)
        const parent = path.dirname(projectsPath);
        const adjacentSkills = path.join(parent, 'skills');
        if (fs.existsSync(adjacentSkills)) return adjacentSkills;

        const appData = getAppDataDir();
        const defaultProjects = path.join(appData, 'projects');
        if (projectsPath !== defaultProjects && fs.existsSync(projectsPath)) {
          return adjacentSkills;
        }

        // 3. Internal fallback
        if (fs.existsSync(internalSkills)) return internalSkills;
        if (projectsPath !== defaultProjects) return internalSkills;
      }
    }
  } catch { /* ignore */ }

  return path.join(getAppDataDir(), 'skills');
}

/**
 * Get the global settings file path.
 */
export function getGlobalSettingsPath() {
  return path.join(getAppDataDir(), 'settings.json');
}

/**
 * Get the secrets file path.
 */
export function getSecretsPath() {
  return path.join(getAppDataDir(), 'secrets.encrypted.json');
}

/**
 * Get the system downloads directory.
 */
export function getDownloadsDir() {
  const platform = os.platform();
  if (platform === 'darwin' || platform === 'linux') {
    return path.join(os.homedir(), 'Downloads');
  }
  // Windows
  return path.join(os.homedir(), 'Downloads');
}

/**
 * Ensure the complete directory structure exists.
 */
export function initializeDirectoryStructure() {
  const appData = getAppDataDir();
  fs.mkdirSync(appData, { recursive: true });

  const projectsDir = getProjectsDir();
  fs.mkdirSync(projectsDir, { recursive: true });

  const skillsDir = getSkillsDir();
  fs.mkdirSync(skillsDir, { recursive: true });

  // Create default skill template
  const templatePath = path.join(skillsDir, 'template.md');
  const sidecarDir = path.join(skillsDir, '.metadata');
  const sidecarPath = path.join(sidecarDir, 'template.json');

  if (!fs.existsSync(templatePath)) {
    const defaultTemplate = `# {{name}}

## Overview
{{overview}}

## Prompt Template
{{template}}

## Parameters

## Examples

## Usage Guidelines
`;
    fs.writeFileSync(templatePath, defaultTemplate, 'utf-8');

    if (!fs.existsSync(sidecarPath)) {
      fs.mkdirSync(sidecarDir, { recursive: true });
      const defaultMeta = {
        skill_id: 'template',
        name: 'Skill Template',
        description: 'Default template for new skills',
        capabilities: ['web_search', 'data_analysis'],
        version: '1.0.0',
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      };
      fs.writeFileSync(sidecarPath, JSON.stringify(defaultMeta, null, 2), 'utf-8');
    }
  }

  console.log('[paths] Directory structure initialized successfully');
}

/**
 * Get a specific project's directory path.
 */
export function getProjectDir(projectId) {
  return path.join(getProjectsDir(), projectId);
}

/**
 * Get a specific project's metadata file path.
 */
export function getProjectFilePath(projectId) {
  return path.join(getProjectDir(projectId), '.metadata', 'project.json');
}

/**
 * Check if a project exists.
 */
export function projectExists(projectId) {
  return fs.existsSync(getProjectFilePath(projectId));
}

/**
 * List all project directories.
 */
export function listProjectDirs() {
  const projectsDir = getProjectsDir();
  if (!fs.existsSync(projectsDir)) return [];

  const dirs = [];
  for (const entry of fs.readdirSync(projectsDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const projectFile = path.join(projectsDir, entry.name, '.metadata', 'project.json');
      if (fs.existsSync(projectFile)) {
        dirs.push(path.join(projectsDir, entry.name));
      }
    }
  }
  return dirs;
}
