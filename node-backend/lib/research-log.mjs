import fs from 'node:fs/promises';
import path from 'node:path';
import { getProjectById } from './projects.mjs';

export function parseResearchLog(content) {
  const interactions = content.split('---').slice(1);
  const entries = [];

  for (const interaction of interactions) {
    const lines = interaction.trim().split(/\r?\n/);
    if (!lines.length || !lines[0]) continue;

    let timestamp = '';
    let provider = '';
    let command = null;
    let output = '';
    let inOutput = false;

    for (const line of lines) {
      if (line.startsWith('### Interaction: ')) {
        timestamp = line.replace('### Interaction: ', '').trim();
      } else if (line.startsWith('**Provider**: ')) {
        provider = line.replace('**Provider**: ', '').trim();
      } else if (line.startsWith('**Command**: ')) {
        command = line.replace('**Command**: ', '').trim().replace(/^`|`$/g, '');
      } else if (line.trim() === '#### Agent Output:') {
        inOutput = true;
      } else if (inOutput) {
        output += `${line}\n`;
      }
    }

    entries.push({
      timestamp,
      provider,
      command,
      content: output.trim(),
    });
  }

  return entries;
}

export async function getResearchLog(projectId) {
  const project = await getProjectById(projectId);
  const logPath = path.join(project.path, 'research_log.md');

  try {
    const raw = await fs.readFile(logPath, 'utf8');
    return parseResearchLog(raw);
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

export async function clearResearchLog(projectId) {
  const project = await getProjectById(projectId);
  const logPath = path.join(project.path, 'research_log.md');

  try {
    await fs.access(logPath);
  } catch {
    return;
  }

  await fs.writeFile(
    logPath,
    `# Research Log: ${project.name}\n\nThis file tracks automatic agent interactions and observations.\n\n`,
    'utf8',
  );
}
