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
