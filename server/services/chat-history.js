import fs from 'fs';
import path from 'path';
import { getAppDataDir } from './paths.js';

export function getChatDirectory(projectId) {
  const baseDir = getAppDataDir();
  return path.join(baseDir, projectId, 'chats');
}

function formatChatMarkdown(messages) {
  let content = '# Conversation\n\n';
  for (const message of messages) {
    const role = message.role === 'user' ? 'User' : 'Assistant';
    content += `## ${role}\n${message.content}\n\n`;
  }
  return content;
}

export function saveChatToFile(projectId, messages, model) {
  const chatDir = getChatDirectory(projectId);
  if (!fs.existsSync(chatDir)) {
    fs.mkdirSync(chatDir, { recursive: true });
  }

  const timestamp = new Date();
  const filePrefix = `chat_${timestamp.toISOString().replace(/[:.]/g, '-').replace('T', '_')}`;
  const mdFileName = `${filePrefix}.md`;
  const mdFilePath = path.join(chatDir, mdFileName);

  const mdContent = formatChatMarkdown(messages);
  fs.writeFileSync(mdFilePath, mdContent, 'utf8');

  const metadataDir = path.join(chatDir, '.metadata', 'chats');
  if (!fs.existsSync(metadataDir)) {
    fs.mkdirSync(metadataDir, { recursive: true });
  }

  const metadataPath = path.join(metadataDir, `${filePrefix}.json`);
  const metadata = {
    created: timestamp.toISOString(),
    model: model || 'unknown',
    message_count: messages.length
  };
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

  return mdFileName;
}

export function loadChatFromFile(projectId, fileName) {
  const chatDir = getChatDirectory(projectId);
  const filePath = path.join(chatDir, fileName);
  
  if (!fs.existsSync(filePath)) throw new Error('Chat file not found');
  const content = fs.readFileSync(filePath, 'utf8');

  const messages = [];
  let currentRole = null;
  let currentContent = '';
  let inConversation = false;

  for (const line of content.split('\n')) {
    if (line.trim() === '---') continue;
    if (line.trim() === '# Conversation') {
      inConversation = true;
      continue;
    }
    if (!inConversation) continue;

    if (line.startsWith('## User')) {
      if (currentRole) messages.push({ role: currentRole, content: currentContent.trim() });
      currentRole = 'user';
      currentContent = '';
    } else if (line.startsWith('## Assistant')) {
      if (currentRole) messages.push({ role: currentRole, content: currentContent.trim() });
      currentRole = 'assistant';
      currentContent = '';
    } else if (currentRole) {
      if (currentContent !== '') currentContent += '\n';
      currentContent += line;
    }
  }

  if (currentRole) messages.push({ role: currentRole, content: currentContent.trim() });
  return messages;
}

export function getChatFiles(projectId) {
  const chatDir = getChatDirectory(projectId);
  if (!fs.existsSync(chatDir)) return [];

  const files = fs.readdirSync(chatDir)
    .filter(f => f.endsWith('.md'))
    .sort((a, b) => b.localeCompare(a)); // sort descending

  return files.map(f => ({ id: f, name: f }));
}
