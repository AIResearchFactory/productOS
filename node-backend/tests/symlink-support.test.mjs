import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { listProjects, getProjectFiles } from '../lib/projects.mjs';
import { listSkills } from '../lib/skills.mjs';

// Setup temporary environment
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'symlink-test-'));
const projectsDir = path.join(tempDir, 'projects');
const skillsDir = path.join(tempDir, 'skills');
const externalDir = path.join(tempDir, 'external');

process.env.PROJECTS_DIR = projectsDir;
process.env.SKILLS_DIR = skillsDir;
process.env.HOME = tempDir;

test('symlink support', async (t) => {
  await fs.mkdir(projectsDir, { recursive: true });
  await fs.mkdir(skillsDir, { recursive: true });
  await fs.mkdir(externalDir, { recursive: true });

  await t.test('detects symlinked projects', async () => {
    // 1. Create a real project in an external location
    const realProjectPath = path.join(externalDir, 'real-project');
    await fs.mkdir(realProjectPath, { recursive: true });
    await fs.mkdir(path.join(realProjectPath, '.metadata'), { recursive: true });
    const metadata = { id: 'symlinked-id', name: 'Symlinked Project', created: new Date().toISOString() };
    await fs.writeFile(path.join(realProjectPath, '.metadata', 'project.json'), JSON.stringify(metadata));
    await fs.writeFile(path.join(realProjectPath, 'hello.txt'), 'world');

    // 2. Create a symlink in the projects directory
    const symlinkPath = path.join(projectsDir, 'symlinked-project');
    await fs.symlink(realProjectPath, symlinkPath, 'dir');

    // 3. List projects - should find the symlinked one
    const projects = await listProjects();
    const found = projects.find(p => p.id === 'symlinked-id');
    assert.ok(found, 'Should find the symlinked project');
    assert.strictEqual(found.name, 'Symlinked Project');
  });

  await t.test('lists files in symlinked projects', async () => {
    const files = await getProjectFiles('symlinked-id');
    assert.ok(files.includes('hello.txt'), 'Should list files in symlinked project');
  });

  await t.test('detects symlinked skills', async () => {
    // 1. Create a real skill in an external location
    const realSkillPath = path.join(externalDir, 'real-skill');
    await fs.mkdir(realSkillPath, { recursive: true });
    await fs.writeFile(path.join(realSkillPath, 'SKILL.md'), '# Real Skill\nOverview: Test skill');

    // 2. Create a symlink in the skills directory
    const symlinkPath = path.join(skillsDir, 'symlinked-skill');
    await fs.symlink(realSkillPath, symlinkPath, 'dir');

    // 3. List skills - should find the symlinked one
    const skills = await listSkills();
    const found = skills.find(s => s.id === 'symlinked-skill');
    assert.ok(found, 'Should find the symlinked skill');
    assert.strictEqual(found.name, 'Real Skill');
  });

  // Cleanup after all tests
  t.after(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });
});
