import fs from 'node:fs/promises';
import path from 'node:path';
import { getProjectById } from './projects.mjs';
import { ChatService } from './chat.mjs';

export function parseChatFileTimestamp(fileName) {
  if (!fileName || typeof fileName !== 'string') return null;
  const clean = fileName.replace(/^chat_/, '').replace(/\.md$/, '');
  const tIndex = clean.indexOf('T');
  if (tIndex !== -1) {
    const datePart = clean.substring(0, tIndex);
    const timePart = clean.substring(tIndex + 1).replace('Z', '');
    const segments = timePart.split('-');
    if (segments.length >= 3) {
      const hh = segments[0];
      const mm = segments[1];
      const ss = segments[2];
      const ms = segments[3] || '000';
      const iso = `${datePart}T${hh}:${mm}:${ss}.${ms}Z`;
      const date = new Date(iso);
      if (!isNaN(date.getTime())) return date.getTime();
    }
  }
  return null;
}

export function parseResearchLog(content) {
  const interactions = content.split('---').slice(1);
  const entries = [];

  for (const interaction of interactions) {
    const lines = interaction.trim().split(/\r?\n/);
    if (!lines.length || !lines[0]) continue;

    let timestamp = '';
    let provider = '';
    let command = null;
    let chatFile = null;
    let output = '';
    let inOutput = false;

    for (const line of lines) {
      if (line.startsWith('### Interaction: ')) {
        timestamp = line.replace('### Interaction: ', '').trim();
      } else if (line.startsWith('**Provider**: ')) {
        provider = line.replace('**Provider**: ', '').trim();
      } else if (line.startsWith('**Chat File**: ')) {
        chatFile = line.replace('**Chat File**: ', '').trim().replace(/^`|`$/g, '');
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
      chatFile,
      content: output.trim(),
    });
  }

  return entries;
}

export async function getResearchLog(projectId) {
  const project = await getProjectById(projectId);
  const logPath = path.join(project.path, 'research_log.md');

  let entries = [];
  try {
    const raw = await fs.readFile(logPath, 'utf8');
    entries = parseResearchLog(raw);
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }

  // Correlate with existing chat files for entries without explicit chatFile
  try {
    const chatFiles = await ChatService.getChatFiles(projectId);
    if (chatFiles.length > 0) {
      const parsedChatFiles = chatFiles
        .map(file => ({ file, time: parseChatFileTimestamp(file) }))
        .filter(c => c.time !== null);

      for (const entry of entries) {
        if (!entry.chatFile && entry.timestamp) {
          const entryTime = new Date(entry.timestamp).getTime();
          if (!isNaN(entryTime)) {
            // Find closest chat file within 60 seconds
            let closest = null;
            let minDiff = 60000;
            for (const c of parsedChatFiles) {
              const diff = Math.abs(c.time - entryTime);
              if (diff < minDiff) {
                minDiff = diff;
                closest = c.file;
              }
            }
            if (closest) {
              entry.chatFile = closest;
            }
          }
        }
      }
    }
  } catch (err) {
    // Non-fatal if chat files cannot be correlated
    console.warn('[ResearchLog] Could not correlate chat files:', err);
  }

  return entries;
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

export async function logEvent(projectId, provider, command, content, chatFile = null) {
  const project = await getProjectById(projectId);
  const logPath = path.join(project.path, 'research_log.md');

  const timestamp = new Date().toISOString();
  let interaction = `
---
### Interaction: ${timestamp}
**Provider**: ${provider}
`;
  if (chatFile) {
    interaction += `**Chat File**: ${chatFile}\n`;
  }
  if (command) {
    interaction += `**Command**: \`${command}\`\n`;
  }
  interaction += `#### Agent Output:
${content}
`;

  try {
    await fs.appendFile(logPath, interaction, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      await clearResearchLog(projectId);
      await fs.appendFile(logPath, interaction, 'utf8');
    } else {
      throw error;
    }
  }
}
