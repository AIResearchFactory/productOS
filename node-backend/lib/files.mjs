import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';
import { getProjectById } from './projects.mjs';
import { getGlobalSettingsPath } from './paths.mjs';
import { classifyContent, DataClass, redactSecrets } from './silent-learner/privacy-filter.mjs';

async function readGlobalSettings() {
  const settingsPath = await getGlobalSettingsPath();
  try {
    return JSON.parse(await fs.readFile(settingsPath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

export function parseVttToMarkdown(vttContent, fileStem) {
  const lines = vttContent.split(/\r?\n/);
  const dialogueEntries = [];
  const speakersSet = new Set();

  let inHeaderOrNote = true;
  let inNoteBlock = false;
  let currentSpeaker = null;
  let currentTextLines = [];

  const timestampRegex = /^\d{2}:[0-5]\d:[0-5]\d[.,]\d{3}\s+-->\s+\d{2}:[0-5]\d:[0-5]\d[.,]\d{3}/;
  const timestampShortRegex = /^[0-5]?\d:[0-5]\d[.,]\d{3}\s+-->\s+[0-5]?\d:[0-5]\d[.,]\d{3}/;

  function flushCurrentSpeaker() {
    if (currentTextLines.length > 0) {
      const text = currentTextLines.join(' ').replace(/\s+/g, ' ').trim();
      if (text) {
        dialogueEntries.push({ speaker: currentSpeaker, text });
      }
      currentTextLines = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      inNoteBlock = false;
      continue;
    }

    if (inNoteBlock) {
      continue;
    }

    if (line.startsWith('NOTE')) {
      inNoteBlock = true;
      continue;
    }

    if (line.startsWith('WEBVTT') || line.startsWith('Kind:') || line.startsWith('Language:')) {
      continue;
    }
    if (timestampRegex.test(line) || timestampShortRegex.test(line)) {
      inHeaderOrNote = false;
      continue;
    }
    if (inHeaderOrNote && /^\d+$/.test(line)) {
      continue;
    }
    if (/^\d+$/.test(line) && i + 1 < lines.length && (timestampRegex.test(lines[i + 1].trim()) || timestampShortRegex.test(lines[i + 1].trim()))) {
      continue;
    }

    let speaker = null;
    let text = line;

    const vTagMatch = text.match(/^<v(?:\.[^>]+)?\s+([^>]+)>(.*)/i);
    if (vTagMatch) {
      speaker = vTagMatch[1].trim();
      text = vTagMatch[2];
    }

    text = text.replace(/<[^>]+>/g, '').trim();

    if (!speaker) {
      const prefixMatch = text.match(/^([A-Z][A-Za-z0-9\s._-]{1,30}):\s+(.*)/);
      if (prefixMatch) {
        speaker = prefixMatch[1].trim();
        text = prefixMatch[2];
      }
    }

    if (!text) continue;

    if (speaker) {
      speakersSet.add(speaker);
    }

    if (speaker && speaker === currentSpeaker) {
      currentTextLines.push(text);
    } else {
      flushCurrentSpeaker();
      currentSpeaker = speaker;
      currentTextLines.push(text);
    }
  }

  flushCurrentSpeaker();

  const formattedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const title = fileStem.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const participants = Array.from(speakersSet);

  let md = `# Meeting Transcript: ${title}\n\n`;
  md += `**Date**: ${formattedDate}\n`;
  md += `**Participants**: ${participants.length > 0 ? participants.join(', ') : 'Not specified'}\n\n`;
  md += `---\n\n`;
  md += `## Transcript\n\n`;

  if (dialogueEntries.length === 0) {
    const rawClean = vttContent
      .replace(/^WEBVTT.*/gm, '')
      .replace(/^NOTE[\s\S]*?(?=\n\r?\n|$)/gm, '')
      .replace(/^\d+$/gm, '')
      .replace(/^\d{2}:.*-->.*/gm, '')
      .replace(/<[^>]+>/g, '')
      .trim();
    md += rawClean || '_Empty transcript file._';
  } else {
    for (const entry of dialogueEntries) {
      if (entry.speaker) {
        md += `**${entry.speaker}**: ${entry.text}\n\n`;
      } else {
        md += `${entry.text}\n\n`;
      }
    }
  }

  return md;
}

export class FileService {
  static async importDocument(projectId, sourcePath) {
    const project = await getProjectById(projectId);
    const fileStem = path.parse(sourcePath).name;
    const ext = path.parse(sourcePath).ext.toLowerCase();
    const newFileName = `${fileStem}.md`;
    const targetPath = path.join(project.path, newFileName);

    let markdownContent = '';

    if (ext === '.pdf') {
      try {
        const buffer = await fs.readFile(sourcePath);
        const parser = new PDFParse({ data: buffer });
        const textResult = await parser.getText();
        markdownContent = textResult.text || '';
        await parser.destroy();
      } catch (error) {
        throw new Error(`Failed to extract text from PDF: ${error.message}`);
      }
    } else if (ext === '.vtt') {
      const rawContent = await fs.readFile(sourcePath, 'utf8');
      markdownContent = parseVttToMarkdown(rawContent, fileStem);
    } else {
      try {
        markdownContent = execSync(`pandoc -t markdown -- "${sourcePath}"`, { encoding: 'utf8' });
      } catch (error) {
        throw new Error(`Pandoc conversion failed: ${error.message}. Make sure pandoc is installed.`);
      }
    }

    await fs.writeFile(targetPath, markdownContent, 'utf8');
    return newFileName;
  }

  static async importTranscript(projectId, sourcePath, options = {}) {
    const project = await getProjectById(projectId);
    const fileStem = path.parse(sourcePath).name;
    const ext = path.parse(sourcePath).ext.toLowerCase();

    let newFileName = `${fileStem}.md`;
    let targetPath = path.join(project.path, newFileName);
    let counter = 1;
    const fileExists = async (p) => fs.access(p).then(() => true).catch(() => false);
    while (await fileExists(targetPath)) {
      newFileName = `${fileStem}_${counter}.md`;
      targetPath = path.join(project.path, newFileName);
      counter++;
    }

    const rawContent = await fs.readFile(sourcePath, 'utf8');
    let markdownContent = '';

    if (ext === '.vtt' || rawContent.includes('WEBVTT') || rawContent.includes('-->')) {
      markdownContent = parseVttToMarkdown(rawContent, fileStem);
    } else {
      markdownContent = `# Meeting Transcript: ${fileStem}\n\n${rawContent}`;
    }

    // Deterministic secret classification & redaction
    const classification = classifyContent(markdownContent, { filePath: sourcePath });
    const isSecretOrExcluded = !classification.shouldStore ||
      classification.dataClass === DataClass.SECRET ||
      classification.dataClass === DataClass.EXCLUDED;

    if (isSecretOrExcluded) {
      const { redacted } = redactSecrets(markdownContent);
      markdownContent = redacted;
    }

    // AI summarization requires explicit opt-in and non-secret data
    const summarizeWithAi = Boolean(options.summarizeWithAi);
    if (summarizeWithAi && options.aiProvider && !isSecretOrExcluded) {
      const settings = options.settings || (await readGlobalSettings().catch(() => ({})));
      const providerType = settings?.activeProvider || settings?.active_provider || 'hostedApi';
      const isLocalProvider = providerType === 'ollama';
      const allowHosted = Boolean(
        options.allowHostedSummarization ||
        settings?.transcriptImport?.allowHostedSummarization ||
        settings?.silentLearner?.allowHostedSummarization ||
        settings?.silentLearner?.allowHosted
      );

      if (isLocalProvider || allowHosted) {
        try {
          const { redacted: safeTranscriptPrompt } = redactSecrets(markdownContent);
          const prompt = `Analyze the following meeting transcript and generate a structured summary report including:
- Executive Summary
- Key Discussion Points
- Decisions Made
- Action Items

Transcript:
${safeTranscriptPrompt.slice(0, 15000)}`;

          const response = await options.aiProvider.chat({
            messages: [{ role: 'user', content: prompt }]
          });
          if (response && response.content && response.content.trim()) {
            const aiSummary = response.content.trim();
            markdownContent = `# Meeting Transcript: ${fileStem}\n\n` +
              `## AI Summary & Key Takeaways\n\n${aiSummary}\n\n---\n\n` +
              markdownContent.replace(/^# Meeting Transcript: [^\n]+\n\n/, '');
          }
        } catch (err) {
          console.warn('[FileService] AI transcript summarization skipped:', err.message);
        }
      } else {
        console.warn('[FileService] AI transcript summarization skipped: Hosted provider requires explicit opt-in');
      }
    }

    await fs.writeFile(targetPath, markdownContent, 'utf8');
    return newFileName;
  }

  static async exportDocument(projectId, fileName, targetPath, exportFormat) {
    const project = await getProjectById(projectId);
    const sourcePath = path.resolve(project.path, fileName);
    
    // Ensure target path is absolute or resolve relative to downloads
    let finalTargetPath = targetPath;
    if (!path.isAbsolute(targetPath)) {
        // Default to home Downloads if not absolute
        finalTargetPath = path.join(process.env.HOME || '', 'Downloads', targetPath);
    }

    const args = ['-f', 'markdown', '-o', finalTargetPath];
    
    if (exportFormat.toLowerCase() === 'pdf') {
        // Try to detect pdf engines similar to Rust implementation
        try {
            execSync('wkhtmltopdf --version', { stdio: 'ignore' });
            args.push('--pdf-engine=wkhtmltopdf');
        } catch {
            args.push('--pdf-engine=weasyprint'); // Fallback/Default
        }
    }

    return new Promise((resolve, reject) => {
      const child = spawn('pandoc', args);
      const content = fs.readFile(sourcePath); // We could stream this but for now read all
      
      content.then(data => {
          child.stdin.write(data);
          child.stdin.end();
      }).catch(reject);

      let stderr = '';
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Pandoc export failed with code ${code}: ${stderr}`));
        } else {
          resolve();
        }
      });
    });
  }
}
