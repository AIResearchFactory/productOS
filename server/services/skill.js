import fs from 'fs';
import path from 'path';
import { getSkillsDir } from './paths.js';

/**
 * Port of Rust SkillService + models/skill.rs.
 */

function parseSkillMarkdown(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const id = path.basename(filePath, '.md');
  const sidecarDir = path.join(path.dirname(filePath), '.metadata');
  const sidecarPath = path.join(sidecarDir, `${id}.json`);

  let sidecar = {};
  if (fs.existsSync(sidecarPath)) {
    try { sidecar = JSON.parse(fs.readFileSync(sidecarPath, 'utf-8')); } catch { /* ignore */ }
  }

  // Parse markdown for skill metadata
  const lines = content.split('\n');
  let name = sidecar.name || id;
  let description = sidecar.description || '';
  let promptTemplate = '';
  let capabilities = sidecar.capabilities || [];
  let examples = sidecar.examples || [];
  let parameters = sidecar.parameters || [];

  let currentSection = '';
  for (const line of lines) {
    if (line.startsWith('# ')) { name = line.replace(/^# /, '').trim(); continue; }
    if (line.startsWith('## ')) { currentSection = line.replace(/^## /, '').trim().toLowerCase(); continue; }

    if (currentSection === 'overview' || currentSection === 'description') {
      if (line.trim()) description += (description ? ' ' : '') + line.trim();
    } else if (currentSection === 'prompt template' || currentSection === 'prompt') {
      promptTemplate += line + '\n';
    }
  }

  const now = new Date().toISOString();
  const skill = {
    id,
    name: sidecar.name || name,
    description: sidecar.description || description,
    capabilities: sidecar.capabilities || capabilities,
    prompt_template: promptTemplate.trim() || sidecar.prompt_template || `You are an AI assistant with the skill: ${id}\n\nPlease help the user.`,
    examples: sidecar.examples || examples,
    parameters: sidecar.parameters || parameters,
    version: sidecar.version || '1.0.0',
    created: sidecar.created || now,
    updated: sidecar.updated || now,
    file_path: filePath
  };

  // Auto-create/update sidecar
  fs.mkdirSync(sidecarDir, { recursive: true });
  const { file_path: _fp, ...sidecarData } = skill;
  sidecarData.skill_id = id;
  fs.writeFileSync(sidecarPath, JSON.stringify(sidecarData, null, 2), 'utf-8');

  return skill;
}

export function discoverSkills() {
  const skillsDir = getSkillsDir();
  fs.mkdirSync(skillsDir, { recursive: true });

  // Seed PM skills
  try { seedPmSkills(); } catch (e) { console.error('[skill] Failed to seed PM skills:', e.message); }

  const skills = [];
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (entry.name.startsWith('.') || entry.name === 'template.md') continue;
    if (!entry.name.endsWith('.md')) continue;

    try {
      skills.push(parseSkillMarkdown(path.join(skillsDir, entry.name)));
    } catch (e) {
      console.warn(`[skill] Failed to load skill ${entry.name}: ${e.message}`);
    }
  }

  // Seed default skill if empty
  if (skills.length === 0) {
    const defaultSkill = createSkillTemplate('research-specialist', 'Research Specialist',
      'A versatile AI assistant capable of conducting research, analyzing topics, and synthesizing information.',
      ['research', 'analysis', 'synthesis']);
    try { saveSkill(defaultSkill); skills.push(defaultSkill); }
    catch (e) { console.error('[skill] Failed to seed default:', e.message); }
  }

  skills.sort((a, b) => a.name.localeCompare(b.name));
  return skills;
}

export function loadSkill(skillId) {
  const skillPath = path.join(getSkillsDir(), `${skillId}.md`);
  if (!fs.existsSync(skillPath)) throw new Error(`Skill not found: ${skillId}`);
  return parseSkillMarkdown(skillPath);
}

export function saveSkill(skill) {
  const skillsDir = getSkillsDir();
  fs.mkdirSync(skillsDir, { recursive: true });

  const skillPath = path.join(skillsDir, `${skill.id}.md`);
  const md = skillToMarkdown(skill);
  fs.writeFileSync(skillPath, md, 'utf-8');

  // Save sidecar
  const sidecarDir = path.join(skillsDir, '.metadata');
  fs.mkdirSync(sidecarDir, { recursive: true });
  const { file_path: _fp, ...sidecarData } = skill;
  sidecarData.skill_id = skill.id;
  fs.writeFileSync(path.join(sidecarDir, `${skill.id}.json`), JSON.stringify(sidecarData, null, 2), 'utf-8');
}

export function deleteSkill(skillId) {
  const skillsDir = getSkillsDir();
  const skillPath = path.join(skillsDir, `${skillId}.md`);
  if (!fs.existsSync(skillPath)) throw new Error(`Skill not found: ${skillId}`);
  fs.unlinkSync(skillPath);

  const sidecarPath = path.join(skillsDir, '.metadata', `${skillId}.json`);
  if (fs.existsSync(sidecarPath)) fs.unlinkSync(sidecarPath);
}

export function createSkill(name, description, promptTemplate, capabilities = []) {
  const skillId = name.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9_-]/g, '');
  const skillsDir = getSkillsDir();
  if (fs.existsSync(path.join(skillsDir, `${skillId}.md`))) {
    throw new Error(`Skill already exists: ${skillId}`);
  }

  const skill = createSkillTemplate(skillId, name, description, capabilities);
  if (promptTemplate) skill.prompt_template = promptTemplate;
  saveSkill(skill);
  return skill;
}

export function createSkillTemplate(id, name, description, capabilities) {
  const now = new Date().toISOString();
  return {
    id, name, description, capabilities,
    prompt_template: `You are an AI assistant with the following skill: ${id}\n\nPlease help the user with their request.`,
    examples: [], parameters: [],
    version: '1.0.0', created: now, updated: now,
    file_path: `${id}.md`
  };
}

export function updateSkill(skill) {
  skill.updated = new Date().toISOString();
  saveSkill(skill);
}

export function getSkillsByCategory(category) {
  return discoverSkills().filter(s =>
    s.capabilities.some(c => c.toLowerCase().includes(category.toLowerCase()))
  );
}

function skillToMarkdown(skill) {
  let md = `# ${skill.name}\n\n`;
  md += `## Overview\n${skill.description}\n\n`;
  md += `## Prompt Template\n${skill.prompt_template}\n\n`;
  if (skill.parameters?.length) {
    md += `## Parameters\n`;
    for (const p of skill.parameters) {
      md += `- **${p.name}** (${p.param_type || p.type || 'string'}): ${p.description || ''}${p.required ? ' [required]' : ''}${p.default_value ? ` [default: ${p.default_value}]` : ''}\n`;
    }
    md += '\n';
  }
  if (skill.examples?.length) {
    md += `## Examples\n`;
    for (const ex of skill.examples) { md += `- ${ex}\n`; }
    md += '\n';
  }
  return md;
}

function seedPmSkills() {
  // Port of pm_skills::get_pm_skills_definitions()
  // The PM skills are seeded as markdown files — we just ensure the directory exists
  // The actual skill definitions were in a separate Rust module; we'll seed basic ones
  const skillsDir = getSkillsDir();
  const pmSkills = [
    { id: 'product-strategy', name: 'Product Strategy', desc: 'Define product vision, strategy, and roadmap.', caps: ['strategy', 'roadmap', 'vision'] },
    { id: 'user-research', name: 'User Research', desc: 'Conduct user interviews, surveys, and analyze feedback.', caps: ['research', 'user-feedback', 'interviews'] },
    { id: 'competitive-analysis', name: 'Competitive Analysis', desc: 'Analyze competitors, market trends, and positioning.', caps: ['competitive', 'market-analysis', 'trends'] },
    { id: 'prd-writer', name: 'PRD Writer', desc: 'Create detailed product requirements documents.', caps: ['prd', 'requirements', 'specifications'] },
    { id: 'presentation-builder', name: 'Presentation Builder', desc: 'Create compelling presentations and pitch decks.', caps: ['presentation', 'slides', 'pitch'] },
  ];

  for (const s of pmSkills) {
    const skillPath = path.join(skillsDir, `${s.id}.md`);
    if (!fs.existsSync(skillPath)) {
      const skill = createSkillTemplate(s.id, s.name, s.desc, s.caps);
      try { saveSkill(skill); } catch { /* ignore */ }
    }
  }
}
