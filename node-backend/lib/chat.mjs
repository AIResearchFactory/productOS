import fs from 'node:fs/promises';
import path from 'node:path';
import { getAppDataDir, getProjectsDir } from './paths.mjs';

export class ChatService {
  static async getChatDirectory(projectId) {
    const projectsDir = await getProjectsDir();
    return path.join(projectsDir, projectId, 'chats');
  }

  static formatChatMarkdown(messages) {
    let content = '# Conversation\n\n';
    for (const msg of messages) {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      content += `## ${role}\n${msg.content}\n\n`;
    }
    return content;
  }

  static async saveChatToFile(projectId, messages, model) {
    const chatDir = await this.getChatDirectory(projectId);
    await fs.mkdir(chatDir, { recursive: true });

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const filePrefix = `chat_${timestamp}`;
    const mdFileName = `${filePrefix}.md`;
    const mdFilePath = path.join(chatDir, mdFileName);

    const mdContent = this.formatChatMarkdown(messages);
    await fs.writeFile(mdFilePath, mdContent, 'utf8');

    const metadataDir = path.join(chatDir, '.metadata', 'chats');
    await fs.mkdir(metadataDir, { recursive: true });
    const metadataPath = path.join(metadataDir, `${filePrefix}.json`);

    const metadata = {
      created: now.toISOString(),
      model,
      message_count: messages.length,
    };
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

    return mdFileName;
  }

  static async getChatFiles(projectId) {
    const chatDir = await this.getChatDirectory(projectId);
    try {
      const entries = await fs.readdir(chatDir, { withFileTypes: true });
      const files = entries
        .filter(e => e.isFile() && e.name.endsWith('.md'))
        .map(e => e.name);
      
      files.sort((a, b) => b.localeCompare(a));
      return files;
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }

  static async loadChatFromFile(projectId, fileName) {
    const chatDir = await this.getChatDirectory(projectId);
    const filePath = path.join(chatDir, fileName);
    const content = await fs.readFile(filePath, 'utf8');
    return this.parseChatMarkdown(content);
  }

  static parseChatMarkdown(content) {
    const messages = [];
    let currentRole = null;
    let currentContent = '';
    let inConversation = false;

    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      if (line.trim() === '---') continue;
      if (line.trim() === '# Conversation') {
        inConversation = true;
        continue;
      }
      if (!inConversation) continue;

      if (line.startsWith('## User')) {
        if (currentRole) {
          messages.push({ role: currentRole, content: currentContent.trim() });
          currentContent = '';
        }
        currentRole = 'user';
      } else if (line.startsWith('## Assistant')) {
        if (currentRole) {
          messages.push({ role: currentRole, content: currentContent.trim() });
          currentContent = '';
        }
        currentRole = 'assistant';
      } else if (currentRole) {
        currentContent += line + '\n';
      }
    }

    if (currentRole) {
      messages.push({ role: currentRole, content: currentContent.trim() });
    }

    return messages;
  }
}
