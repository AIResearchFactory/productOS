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
