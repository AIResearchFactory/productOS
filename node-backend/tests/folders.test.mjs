import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

test('Folder management operations work within project structure', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'folder-test-'));
  try {
    const subfolder = path.join(tmpDir, 'research', 'competitors');
    await fs.mkdir(subfolder, { recursive: true });
    
    // Verify directory exists
    const stat1 = await fs.stat(subfolder);
    assert.equal(stat1.isDirectory(), true);

    // Write file inside subfolder
    await fs.writeFile(path.join(subfolder, 'notes.md'), '# Notes', 'utf8');

    // Rename folder
    const renamed = path.join(tmpDir, 'research', 'market-analysis');
    await fs.rename(subfolder, renamed);
    const stat2 = await fs.stat(renamed);
    assert.equal(stat2.isDirectory(), true);
    const content = await fs.readFile(path.join(renamed, 'notes.md'), 'utf8');
    assert.equal(content, '# Notes');

    // Delete folder recursively
    await fs.rm(renamed, { recursive: true, force: true });
    await assert.rejects(async () => fs.stat(renamed));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('Moving a file between root and subfolders preserves content and updates relative path', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'move-file-test-'));
  try {
    // 1. Create file at root
    const rootFile = path.join(tmpDir, 'report.md');
    await fs.writeFile(rootFile, '# Q4 Report', 'utf8');

    // 2. Create destination folder and move file into it
    const targetFolder1 = path.join(tmpDir, 'courses');
    await fs.mkdir(targetFolder1, { recursive: true });
    const movedFile1 = path.join(targetFolder1, 'report.md');
    await fs.rename(rootFile, movedFile1);

    await assert.rejects(async () => fs.stat(rootFile));
    assert.equal(await fs.readFile(movedFile1, 'utf8'), '# Q4 Report');

    // 3. Move file from courses/ to another folder research/2026/
    const targetFolder2 = path.join(tmpDir, 'research', '2026');
    await fs.mkdir(targetFolder2, { recursive: true });
    const movedFile2 = path.join(targetFolder2, 'report.md');
    await fs.rename(movedFile1, movedFile2);

    await assert.rejects(async () => fs.stat(movedFile1));
    assert.equal(await fs.readFile(movedFile2, 'utf8'), '# Q4 Report');

    // 4. Move file back to root
    await fs.rename(movedFile2, rootFile);
    assert.equal(await fs.readFile(rootFile, 'utf8'), '# Q4 Report');
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
