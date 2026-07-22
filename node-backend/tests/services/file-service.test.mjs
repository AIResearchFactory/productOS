import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createProject } from '../../../node-backend/lib/projects.mjs';
import { FileService } from '../../../node-backend/lib/files.mjs';

let tempProjectsDir;

beforeEach(async () => {
  tempProjectsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'productOS-tests-projects-'));
  process.env.PROJECTS_DIR = tempProjectsDir;
});

afterEach(async () => {
  await fs.rm(tempProjectsDir, { recursive: true, force: true });
  delete process.env.PROJECTS_DIR;
});

test('File Service - importDocument (PDF native extraction)', async () => {
  // 1. Create a dummy project
  const project = await createProject('PDF Test Project');

  // 2. Create a temporary minimal PDF file
  const pdfData = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 24 Tf
100 700 Td
(Hello World from PDF!) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000056 00000 n 
0000000111 00000 n 
0000000244 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
339
%%EOF`;

  const tempPdfPath = path.join(os.tmpdir(), `test-document-${Date.now()}.pdf`);
  await fs.writeFile(tempPdfPath, pdfData, 'utf-8');

  try {
    // 3. Import the PDF document
    const importedName = await FileService.importDocument(project.id, tempPdfPath);
    assert.strictEqual(importedName, `${path.parse(tempPdfPath).name}.md`);

    // 4. Verify that the file was created and contains the extracted text
    const targetPath = path.join(project.path, importedName);
    const targetContent = await fs.readFile(targetPath, 'utf-8');
    assert.match(targetContent, /Hello World from PDF!/);
  } finally {
    // Cleanup temporary PDF
    await fs.rm(tempPdfPath, { force: true });
  }
});

test('File Service - importTranscript (VTT transcript parsing)', async () => {
  const project = await createProject('VTT Test Project');

  const vttData = `WEBVTT - Sync Meeting

NOTE
Recorded on 2026-07-21

1
00:00:01.000 --> 00:00:04.000
<v Alice>Hello everyone! Welcome to the product sync.

2
00:00:04.500 --> 00:00:08.000
<v Bob>Hi Alice, thanks for hosting.
<v Bob>I have updated the feature backlog.

3
00:00:08.500 --> 00:00:12.000
Alice: Perfect! Let's review the items.`;

  const tempVttPath = path.join(os.tmpdir(), `meeting_transcript_${Date.now()}.vtt`);
  await fs.writeFile(tempVttPath, vttData, 'utf-8');

  try {
    const importedName = await FileService.importTranscript(project.id, tempVttPath);
    assert.strictEqual(importedName.endsWith('.md'), true);

    const targetPath = path.join(project.path, importedName);
    const targetContent = await fs.readFile(targetPath, 'utf-8');

    assert.match(targetContent, /# Meeting Transcript/);
    assert.match(targetContent, /Alice/);
    assert.match(targetContent, /Bob/);
    assert.match(targetContent, /Hello everyone! Welcome to the product sync\./);
    assert.match(targetContent, /Hi Alice, thanks for hosting\. I have updated the feature backlog\./);
    assert.match(targetContent, /Perfect! Let's review the items\./);
    assert.strictEqual(targetContent.includes('Recorded on 2026-07-21'), false, 'VTT NOTE block content should be omitted from output');
  } finally {
    await fs.rm(tempVttPath, { force: true });
  }
});

test('File Service - importTranscript privacy boundary and AI opt-in controls', async () => {
  const project = await createProject('Privacy Transcript Test Project');

  let chatCalled = false;
  const mockAiProvider = {
    chat: async () => {
      chatCalled = true;
      return { content: 'AI generated summary of discussion.' };
    }
  };

  const vttData = `WEBVTT\n\n1\n00:00:01.000 --> 00:00:04.000\n<v Alice>Hello from sync.`;
  const tempVttPath = path.join(os.tmpdir(), `privacy_transcript_${Date.now()}.vtt`);
  await fs.writeFile(tempVttPath, vttData, 'utf-8');

  try {
    // 1. Default call (without summarizeWithAi) should NOT invoke AI provider
    chatCalled = false;
    const defaultImport = await FileService.importTranscript(project.id, tempVttPath, { aiProvider: mockAiProvider });
    assert.strictEqual(chatCalled, false, 'Default transcript import should not invoke AI provider without summarizeWithAi opt-in');
    let content = await fs.readFile(path.join(project.path, defaultImport), 'utf-8');
    assert.strictEqual(content.includes('AI Summary'), false);

    // 2. Secret-bearing transcript should skip AI provider and redact secret locally
    const secretVttData = `WEBVTT\n\n1\n00:00:01.000 --> 00:00:04.000\n<v Alice>My token is AWS_SECRET_KEY=secret_key = "A1B2C3D4E5F6G7H8I9J0a1b2c3d4e5f6g7h8i9j0"`;
    const tempSecretVttPath = path.join(os.tmpdir(), `secret_transcript_${Date.now()}.vtt`);
    await fs.writeFile(tempSecretVttPath, secretVttData, 'utf-8');

    chatCalled = false;
    const secretImport = await FileService.importTranscript(project.id, tempSecretVttPath, {
      summarizeWithAi: true,
      aiProvider: mockAiProvider,
      settings: { activeProvider: 'ollama' }
    });
    assert.strictEqual(chatCalled, false, 'Secret-bearing transcript should skip AI provider call');
    content = await fs.readFile(path.join(project.path, secretImport), 'utf-8');
    assert.strictEqual(content.includes('A1B2C3D4E5F6G7H8I9J0a1b2c3d4e5f6g7h8i9j0'), false, 'Raw secrets should not be persisted');
    assert.ok(content.includes('[REDACTED:aws_secret_key]'), 'Secret should be redacted in persisted file');
    await fs.rm(tempSecretVttPath, { force: true });

    // 3. Hosted AI provider without opt-in should skip AI provider call
    chatCalled = false;
    await FileService.importTranscript(project.id, tempVttPath, {
      summarizeWithAi: true,
      aiProvider: mockAiProvider,
      settings: { activeProvider: 'hostedApi' }
    });
    assert.strictEqual(chatCalled, false, 'Hosted AI provider should be skipped without explicit hosted opt-in');

    // 4. Local provider (ollama) or hosted with opt-in should call AI provider
    chatCalled = false;
    const aiImport = await FileService.importTranscript(project.id, tempVttPath, {
      summarizeWithAi: true,
      aiProvider: mockAiProvider,
      settings: { activeProvider: 'ollama' }
    });
    assert.strictEqual(chatCalled, true, 'Local provider with summarizeWithAi should invoke AI provider');
    content = await fs.readFile(path.join(project.path, aiImport), 'utf-8');
    assert.ok(content.includes('AI generated summary of discussion.'));
  } finally {
    await fs.rm(tempVttPath, { force: true });
  }
});


