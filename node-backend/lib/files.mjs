import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { PDFParse } from 'pdf-parse';
import { getProjectById } from './projects.mjs';
import { getGlobalSettingsPath, safeJoin } from './paths.mjs';
import { safeJsonParse } from './safe-json.mjs';
import { classifyContent, DataClass, redactSecrets } from './silent-learner/privacy-filter.mjs';

const execFileAsync = promisify(execFile);
const MAX_IMPORT_PDF_BYTES = 50 * 1024 * 1024;
const SAFE_EXPORT_FORMAT_RE = /^[a-z0-9_-]{1,20}$/;

function sanitizeFileStem(name, fallback = 'imported') {
  const cleaned = String(name || '')
    .replace(/[\0/\\]/g, '_')
    .trim();
  if (!cleaned || cleaned === '.' || cleaned === '..' || cleaned.includes('..')) {
    return fallback;
  }
  return cleaned;
}

async function readGlobalSettings() {
  const settingsPath = await getGlobalSettingsPath();
  try {
    return safeJsonParse(await fs.readFile(settingsPath, 'utf8'));
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
    if (typeof sourcePath !== 'string' || !sourcePath || sourcePath.includes('\0')) {
      const err = new Error('Invalid sourcePath');
      err.statusCode = 400;
      throw err;
    }

    const project = await getProjectById(projectId);
    const parsedSource = path.parse(sourcePath);
    const fileStem = sanitizeFileStem(parsedSource.name, 'document');
    const ext = parsedSource.ext.toLowerCase();
    const newFileName = `${fileStem}.md`;
    const targetPath = await safeJoin(project.path, newFileName);

    let markdownContent = '';

    if (ext === '.pdf') {
      let parser = null;
      try {
        const stat = await fs.stat(sourcePath);
        if (stat.size > MAX_IMPORT_PDF_BYTES) {
          const err = new Error(`PDF exceeds maximum supported size of ${MAX_IMPORT_PDF_BYTES / (1024 * 1024)} MB`);
          err.statusCode = 413;
          throw err;
        }
        const buffer = await fs.readFile(sourcePath);
        if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
          const err = new Error('Invalid PDF file: missing %PDF- header');
          err.statusCode = 400;
          throw err;
        }
        parser = new PDFParse({ data: buffer });
        const textResult = await parser.getText();
        markdownContent = textResult.text || '';
      } catch (error) {
        if (error?.statusCode) throw error;
        throw new Error(`Failed to extract text from PDF: ${error.message}`);
      } finally {
        await parser?.destroy?.().catch(() => {});
      }
    } else if (ext === '.vtt') {
      const rawContent = await fs.readFile(sourcePath, 'utf8');
      markdownContent = parseVttToMarkdown(rawContent, fileStem);
    } else {
      try {
        const { stdout } = await execFileAsync('pandoc', ['-t', 'markdown', '--', sourcePath], {
          encoding: 'utf8',
          timeout: 60000,
        });
        markdownContent = stdout;
      } catch (error) {
        throw new Error(`Pandoc conversion failed: ${error.message}. Make sure pandoc is installed.`);
      }
    }

    await fs.writeFile(targetPath, markdownContent, 'utf8');
    return newFileName;
  }

  static async importTranscript(projectId, sourcePath, options = {}) {
    if (typeof sourcePath !== 'string' || !sourcePath || sourcePath.includes('\0')) {
      const err = new Error('Invalid sourcePath');
      err.statusCode = 400;
      throw err;
    }

    const project = await getProjectById(projectId);
    const parsedSource = path.parse(sourcePath);
    const fileStem = sanitizeFileStem(parsedSource.name, 'transcript');
    const ext = parsedSource.ext.toLowerCase();

    let newFileName = `${fileStem}.md`;
    let targetPath = await safeJoin(project.path, newFileName);
    let counter = 1;
    const fileExists = async (p) => fs.access(p).then(() => true).catch(() => false);
    while (await fileExists(targetPath)) {
      newFileName = `${fileStem}_${counter}.md`;
      targetPath = await safeJoin(project.path, newFileName);
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
    if (typeof targetPath !== 'string' || !targetPath || targetPath.includes('\0')) {
      const err = new Error('Invalid targetPath');
      err.statusCode = 400;
      throw err;
    }

    const normalizedFormat = String(exportFormat || '').trim().toLowerCase();
    if (!SAFE_EXPORT_FORMAT_RE.test(normalizedFormat)) {
      const err = new Error('Invalid exportFormat');
      err.statusCode = 400;
      throw err;
    }

    const project = await getProjectById(projectId);
    const sourcePath = await safeJoin(project.path, fileName);

    let finalTargetPath = targetPath;
    if (!path.isAbsolute(targetPath)) {
      const downloadsDir = path.join(process.env.HOME || os.homedir(), 'Downloads');
      finalTargetPath = await safeJoin(downloadsDir, targetPath);
    }

    const args = ['-f', 'markdown', '-t', normalizedFormat, '-o', finalTargetPath];

    if (normalizedFormat === 'pdf') {
      try {
        await execFileAsync('wkhtmltopdf', ['--version'], { timeout: 5000 });
        args.push('--pdf-engine=wkhtmltopdf', '--pdf-engine-opt=--disable-local-file-access');
      } catch {
        args.push('--pdf-engine=weasyprint');
      }
    }

    const content = await fs.readFile(sourcePath);

    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (err) => {
        if (settled) return;
        settled = true;
        reject(err);
      };

      const child = spawn('pandoc', args);
      let stderr = '';

      child.on('error', (err) => {
        fail(new Error(`Failed to start pandoc: ${err.message}`));
      });

      child.stdin.on('error', (err) => {
        if (err?.code !== 'EPIPE') {
          fail(new Error(`Pandoc stdin error: ${err.message}`));
        }
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        if (code !== 0) {
          reject(new Error(`Pandoc export failed with code ${code}: ${stderr}`));
        } else {
          resolve();
        }
      });

      child.stdin.end(content);
    });
  }
}
