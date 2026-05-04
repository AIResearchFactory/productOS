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

async function readFileIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

async function listFiles(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter(e => e.isFile() && !e.name.startsWith('.'))
      .map(e => e.name)
      .sort();
  } catch {
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

  // 2. README.md
  const readme = await readFileIfExists(path.join(project.path, 'README.md'));
  if (readme) {
    context += '## README.md\n\n';
    context += readme;
    context += '\n\n';
  }

  // 3. Research Log (last 50 lines)
  const researchLog = await readFileIfExists(path.join(project.path, 'research_log.md'));
  if (researchLog) {
    context += '## Recent Research History (from research_log.md)\n\n';
    const lines = researchLog.split('\n');
    const tail = lines.length > 50 ? lines.slice(-50) : lines;
    context += tail.join('\n');
    context += '\n\n';
  }

  // 4. First-Class Artifacts (sorted by confidence, then updated date)
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
    context += 'These are high-quality, structured documents that represent the final output of research phases.\n';
    context += 'Confidence levels indicate the quality/certainty of the artifact.\n\n';

    for (const artifact of artifacts) {
      const confLabel =
        artifact.confidence >= 0.8 ? 'High Confidence' :
        artifact.confidence >= 0.5 ? 'Medium Confidence' :
        artifact.confidence > 0   ? 'Low Confidence' :
        'Unrated / Neutral';

      context += `### [${artifact.artifact_type}] ${artifact.title} (${confLabel})\n`;

      if (artifact.content) {
        const lines = artifact.content.split('\n');
        const preview = lines.slice(0, 15).join('\n');
        context += '```markdown\n';
        context += preview;
        if (lines.length > 15) context += '\n[... content continues ...]';
        context += '\n```\n\n';
      }
    }
  }

  // 5. Research Files & Resources (all other files with previews)
  const files = await listFiles(project.path);
  const skipFiles = new Set(['README.md', 'research_log.md']);
  const researchFiles = files.filter(f => !skipFiles.has(f));

  if (researchFiles.length > 0) {
    context += '## Research Files & Resources\n';
    context += 'These files contain raw data, validations, and technical resources.\n\n';

    for (const file of researchFiles) {
      context += `### File: ${file}\n`;
      const content = await readFileIfExists(path.join(project.path, file));
      if (content) {
        const ext = path.extname(file).slice(1) || 'text';
        const lines = content.split('\n');
        const preview = lines.slice(0, 10).join('\n');
        context += `\`\`\`${ext}\n`;
        context += preview;
        if (lines.length > 10) context += '\n[...]';
        context += '\n```\n\n';
      }
    }
  }

  return context;
}
