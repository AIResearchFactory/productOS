import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createSkill, listSkills, getSkillById, deleteSkill, updateSkill } from '../../../node-backend/lib/skills.mjs';
import * as paths from '../../../node-backend/lib/paths.mjs';

let tempSkillsDir;

beforeEach(async () => {
  tempSkillsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'productOS-tests-skills-'));
  process.env.SKILLS_DIR = tempSkillsDir;
});

afterEach(async () => {
  await fs.rm(tempSkillsDir, { recursive: true, force: true });
  delete process.env.SKILLS_DIR;
});

test('Skill Service - createSkill', async () => {
  const skill = await createSkill({
    name: 'Test Skill',
    description: 'A test description',
    prompt_template: 'Hello {{name}}',
    capabilities: ['chat']
  });
  
  assert.strictEqual(skill.name, 'Test Skill');
  assert.strictEqual(skill.id, 'test-skill');
  assert.strictEqual(skill.prompt_template, 'Hello {{name}}');
  
  const files = await fs.readdir(tempSkillsDir);
  assert.ok(files.includes('test-skill.md'));
});

test('Skill Service - listSkills', async () => {
  await createSkill({ name: 'Skill A', description: 'A', prompt_template: 'A' });
  await createSkill({ name: 'Skill B', description: 'B', prompt_template: 'B' });
  
  const skills = await listSkills();
  assert.strictEqual(skills.length, 2);
  assert.strictEqual(skills[0].name, 'Skill A');
  assert.strictEqual(skills[1].name, 'Skill B');
});

test('Skill Service - updateSkill', async () => {
  const skill = await createSkill({ name: 'Old Skill', description: 'Old', prompt_template: 'Old' });
  skill.name = 'New Skill';
  await updateSkill(skill);
  
  const updated = await getSkillById(skill.id);
  assert.strictEqual(updated.name, 'New Skill');
});

test('Skill Service - deleteSkill', async () => {
  const skill = await createSkill({ name: 'To Delete', description: 'del', prompt_template: 'del' });
  await deleteSkill(skill.id);
  
  const skills = await listSkills();
  assert.strictEqual(skills.length, 0);
});
