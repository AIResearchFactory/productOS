import fs from 'fs';
import path from 'path';
import { resolveProjectPath, loadProjectById, isValidProject } from './project.js';

/**
 * Port of Rust ResearchLogService.
 */

export function logEvent(projectId, providerName, command, content) {
  const projectPath = resolveProjectPath(projectId);
  if (!isValidProject(projectPath)) {
    throw new Error(`Cannot log to non-existent or invalid project: ${projectId}`);
  }

  const logPath = path.join(projectPath, 'research_log.md');
  if (!fs.existsSync(logPath)) {
    let projectName = projectId.replace(/-/g, ' ');
    try { projectName = loadProjectById(projectId).name; } catch { /* ignore */ }
    fs.writeFileSync(logPath, `# Research Log: ${projectName}\n\nThis file tracks automatic agent interactions and observations.\n\n`, 'utf-8');
  }

  const timestamp = new Date().toISOString();
  let entry = `---\n### Interaction: ${timestamp}\n**Provider**: ${providerName}\n`;
  if (command) entry += `**Command**: \`${command}\`\n`;
  entry += `\n#### Agent Output:\n\n${content}\n\n`;

  fs.appendFileSync(logPath, entry, 'utf-8');
}

export function getLog(projectId) {
  const project = loadProjectById(projectId);
  const logPath = path.join(project.path, 'research_log.md');
  if (!fs.existsSync(logPath)) return [];

  const content = fs.readFileSync(logPath, 'utf-8');
  return parseLogContent(content);
}

export function parseLogContent(content) {
  const interactions = content.split('---').slice(1);
  return interactions.map(interaction => {
    const lines = interaction.trim().split('\n');
    let timestamp = '', provider = '', command = null, agentOutput = '', inOutput = false;

    for (const line of lines) {
      if (line.startsWith('### Interaction: ')) { timestamp = line.replace('### Interaction: ', '').trim(); }
      else if (line.startsWith('**Provider**: ')) { provider = line.replace('**Provider**: ', '').trim(); }
      else if (line.startsWith('**Command**: ')) { command = line.replace('**Command**: ', '').trim().replace(/^`|`$/g, ''); }
      else if (line.trim() === '#### Agent Output:') { inOutput = true; }
      else if (inOutput) { agentOutput += line + '\n'; }
    }

    return { timestamp, provider, command, content: agentOutput.trim() };
  }).filter(e => e.timestamp);
}

export function clearLog(projectId) {
  const project = loadProjectById(projectId);
  const logPath = path.join(project.path, 'research_log.md');
  if (fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, `# Research Log: ${project.name}\n\nThis file tracks automatic agent interactions and observations.\n\n`, 'utf-8');
  }
}
