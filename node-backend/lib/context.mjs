/**
 * context.mjs
 * Port of the Rust ContextService::get_project_context() to Node.js.
 *
 * This service builds a rich context string that is injected into the AI
 * system prompt, giving the AI awareness of:
 *   - The project's name, goal, and **filesystem path**
 *   - README.md content
 *   - Recent research log entries
 *   - Artifact summaries with confidence levels
 *   - All other project files with content previews
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { getProjectById } from './projects.mjs';
import * as ArtifactService from './artifacts.mjs';
import { isPathInside } from './paths.mjs';

const IGNORED_FILES = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '.DS_Store', 'LICENSE', 'CREDITS.md', 'metadata.json', 'cost_log.json']);
const IGNORED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.zip', '.tar.gz', '.exe', '.bin', '.pdf', '.docx', '.mp3', '.mp4', '.wav']);

async function readFileIfExists(filePath, projectPath) {
  try {
    const stats = await fs.lstat(filePath);
    
    // If it's a symlink, verify it points inside the project
    if (stats.isSymbolicLink()) {
      if (!projectPath) return null;
      if (!await isPathInside(projectPath, filePath)) {
        console.warn(`[context] Skipping symlink outside project: ${filePath}`);
        return null;
      }
    }

    const targetStats = stats.isSymbolicLink() ? await fs.stat(filePath) : stats;
    // Don't read files larger than 1MB for context
    if (targetStats.size > 1024 * 1024) return null;
    
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

async function listFiles(dir, baseDir = dir, depth = 0) {
  if (depth > 5) return []; // Increased depth slightly but kept safe
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    let files = [];

    for (const e of entries) {
      if (e.name.startsWith('.') || IGNORED_FILES.has(e.name)) continue;

      const fullPath = path.join(dir, e.name);
      const relPath = path.relative(baseDir, fullPath);

      if (e.isDirectory()) {
        // Skip artifact folders covered by ArtifactService
        if (ArtifactService.isArtifactFolder(e.name) && depth === 0) continue;
        
        const subFiles = await listFiles(fullPath, baseDir, depth + 1);
        files.push(...subFiles);
      } else if (e.isFile() || e.isSymbolicLink()) {
        if (IGNORED_EXTENSIONS.has(path.extname(e.name).toLowerCase())) continue;

        // For symlinks, verify they point inside the project
        if (e.isSymbolicLink()) {
          if (!await isPathInside(baseDir, fullPath)) continue;
        }

        files.push(relPath);
      }
    }
    return files.sort();
  } catch (err) {
    console.error(`[context] Error listing files in ${dir}:`, err.message);
    return [];
  }
}

/**
 * Build a rich context string for the given project, to be injected into the AI system prompt.
 * @param {string} projectId
 * @returns {Promise<string>}
 */
export async function getProjectContext(projectId) {
  let context = '# Project Context\n\n';

  // 1. Project Metadata
  let project;
  try {
    project = await getProjectById(projectId);
  } catch {
    return context + '_Project not found._\n';
  }

  context += `**Project Name**: ${project.name}\n`;
  context += `**Project Goal**: ${project.goal || 'Not specified'}\n`;
  context += `**Project Directory**: ${project.path}\n\n`;

  // 2. Load Core Context Files (README and Research Log)
  const [readme, researchLog] = await Promise.all([
    readFileIfExists(path.join(project.path, 'README.md'), project.path),
    readFileIfExists(path.join(project.path, 'research_log.md'), project.path)
  ]);

  if (readme) {
    context += '## README.md\n\n' + readme + '\n\n';
  }

  if (researchLog) {
    context += '## Recent Research History (from research_log.md)\n\n';
    const lines = researchLog.split('\n');
    const tail = lines.length > 50 ? lines.slice(-50) : lines;
    context += tail.join('\n') + '\n\n';
  }

  // 3. First-Class Artifacts (sorted by confidence, then updated date)
  let artifacts = [];
  try {
    artifacts = await ArtifactService.listArtifacts(projectId);
  } catch {
    artifacts = [];
  }

  if (artifacts.length > 0) {
    artifacts.sort((a, b) => {
      const confA = a.confidence ?? 0;
      const confB = b.confidence ?? 0;
      if (confB !== confA) return confB - confA;
      return (b.updated || '').localeCompare(a.updated || '');
    });

    context += '## Project Artifacts (Final Discovery Steps)\n';
    context += 'These are high-quality, structured documents representing final output of research phases.\n\n';

    // Limit to top 5 artifacts for prompt efficiency
    const topArtifacts = artifacts.slice(0, 5);
    for (const artifact of topArtifacts) {
      const confLabel =
        artifact.confidence >= 0.8 ? 'High Confidence' :
        artifact.confidence >= 0.5 ? 'Medium Confidence' :
        artifact.confidence > 0   ? 'Low Confidence' :
        'Unrated';

      context += `### [${artifact.artifact_type}] ${artifact.title} (${confLabel})\n`;

      if (artifact.content) {
        const lines = artifact.content.split('\n');
        const preview = lines.slice(0, 15).join('\n');
        context += '```markdown\n' + preview;
        if (lines.length > 15) context += '\n[... content continues ...]';
        context += '\n```\n\n';
      }
    }
  }

  // 4. Research Files & Resources (Parallelized & Limited)
  const files = await listFiles(project.path);
  const skipFiles = new Set(['README.md', 'research_log.md']);
  // Increase limit to 50 files to ensure documents aren't missed
  const researchFiles = files.filter(f => !skipFiles.has(f)).slice(0, 50);

  if (researchFiles.length > 0) {
    context += '## Research Files & Resources\n';
    context += 'Technical resources and raw data findings.\n\n';

    const filePreviews = await Promise.all(researchFiles.map(async (file) => {
      const content = await readFileIfExists(path.join(project.path, file), project.path);
      if (!content) return `### File: ${file}\n_(Content unavailable or too large)_\n\n`;

      const ext = path.extname(file).slice(1) || 'text';
      const lines = content.split('\n');
      const preview = lines.slice(0, 10).join('\n');
      let result = `### File: ${file}\n\`\`\`${ext}\n${preview}`;
      if (lines.length > 10) result += '\n[...]';
      result += '\n\`\`\`\n\n';
      return result;
    }));

    context += filePreviews.join('');
  }

  return context;
}
