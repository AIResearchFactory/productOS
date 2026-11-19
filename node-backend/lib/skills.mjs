import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { assertSafeId, getSkillsDir, safeJoin } from './paths.mjs';
import { isSafeKey, safeJsonParse } from './safe-json.mjs';

const execFilePromise = promisify(execFile);

async function fileExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function extractSection(markdown, heading) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^## ${escapedHeading}\\r?\\n([\\s\\S]*?)(?=^## |$)`, 'm');
  const match = markdown.match(regex);
  return match ? match[1].trim() : '';
}

function parseParameters(section) {
  if (!section.trim()) return [];
  const blocks = section.split(/\n(?=### )/).map((item) => item.trim()).filter(Boolean);
  const parameters = [];

  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    const header = lines.shift() || '';
    const match = header.match(/^###\s+(.+?)\s+\((.+?),\s*(required|optional)\)$/i);
    if (!match) continue;

    const [, name, type, requiredRaw] = match;
    let defaultValue;
    const bodyLines = [];
    for (const line of lines) {
      if (line.startsWith('Default: ')) {
        defaultValue = line.replace(/^Default:\s*/, '').trim().replace(/^"|"$/g, '');
      } else if (line.trim()) {
        bodyLines.push(line.trim());
      }
    }

    parameters.push({
      name: name.trim(),
      type: type.trim(),
      description: bodyLines.join(' '),
      required: requiredRaw.toLowerCase() === 'required',
      default_value: defaultValue,
    });
  }

  return parameters;
}

function parseExamples(section) {
  if (!section.trim()) return [];
  const blocks = section.split(/\n(?=### Example )/).map((item) => item.trim()).filter(Boolean);
  const examples = [];

  for (const block of blocks) {
    const titleMatch = block.match(/^### Example \d+:\s+(.+)$/m);
    const inputMatch = block.match(/\*\*Input:\*\*[\s\S]*?```(?:json)?\r?\n([\s\S]*?)```/m);
    const outputMatch = block.match(/\*\*Expected Output:\*\*\r?\n([\s\S]*)$/m);
    examples.push({
      title: titleMatch?.[1]?.trim() || 'Example',
      input: inputMatch?.[1]?.trim() || '',
      expected_output: outputMatch?.[1]?.trim() || '',
    });
  }

  return examples;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'skill';
}

function skillToMarkdown(skill) {
  const lines = [];
  lines.push(`# ${skill.name} Skill`, '');
  lines.push('## Overview');
  lines.push(skill.description || '', '');
  lines.push('## Prompt Template');
  lines.push(skill.prompt_template || '', '');

  if (Array.isArray(skill.parameters) && skill.parameters.length > 0) {
    lines.push('## Parameters', '');
    for (const param of skill.parameters) {
      lines.push(`### ${param.name} (${param.type}, ${param.required ? 'required' : 'optional'})`);
      lines.push(param.description || '');
      if (param.default_value) {
        lines.push('', `Default: "${param.default_value}"`);
      }
      lines.push('');
    }
  }

  if (Array.isArray(skill.examples) && skill.examples.length > 0) {
    lines.push('## Examples', '');
    skill.examples.forEach((example, index) => {
      lines.push(`### Example ${index + 1}: ${example.title || `Example ${index + 1}`}`);
      lines.push('**Input:**');
      lines.push('```json');
      lines.push(example.input || '');
      lines.push('```', '');
      lines.push('**Expected Output:**');
      lines.push(example.expected_output || '', '');
    });
  }

  return lines.join('\n').trim() + '\n';
}

function metadataFromSkill(skill) {
  return {
    skill_id: skill.id,
    name: skill.name,
    description: skill.description,
    capabilities: Array.isArray(skill.capabilities) ? skill.capabilities : [],
    version: skill.version || '1.0.0',
    created: skill.created,
    updated: skill.updated,
  };
}

function parseMarkdownSkill(id, markdown, metadata = null) {
  const overview = extractSection(markdown, 'Overview');
  const promptTemplate = extractSection(markdown, 'Prompt Template');
  const parameters = parseParameters(extractSection(markdown, 'Parameters'));
  const examples = parseExamples(extractSection(markdown, 'Examples'));
  const heading = markdown.match(/^#\s+(.+?)(?:\s+Skill)?\s*$/m)?.[1]?.trim();
  const now = new Date().toISOString();

  return {
    id,
    name: metadata?.name || heading || id,
    description: metadata?.description || overview || `Skill loaded from ${id}`,
    capabilities: Array.isArray(metadata?.capabilities) ? metadata.capabilities : [],
    prompt_template: promptTemplate,
    examples,
    parameters,
    version: metadata?.version || '1.0.0',
    created: metadata?.created || now,
    updated: metadata?.updated || now,
  };
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { metadata: null, body: markdown };

  const metadata = Object.create(null);
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (isSafeKey(key)) metadata[key] = value;
  }

  return { metadata, body: markdown.slice(match[0].length).trim() };
}

function parseDirectorySkill(dirPath, markdown) {
  const id = path.basename(dirPath);
  const { metadata, body } = parseFrontmatter(markdown);
  const heading = body.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim();
  const now = new Date().toISOString();

  return {
    id,
    name: metadata?.name || heading || id,
    description: metadata?.description || body.split(/\r?\n/).find((line) => line.trim()) || `Skill loaded from ${id}/SKILL.md`,
    capabilities: [],
    prompt_template: body,
    examples: [],
    parameters: [],
    version: metadata?.version || '1.0.0',
    created: now,
    updated: now,
  };
}

async function loadSkillFromFile(filePath) {
  const markdown = await fs.readFile(filePath, 'utf8');
  const id = path.basename(filePath, '.md');
  const sidecarPath = path.join(path.dirname(filePath), '.metadata', `${id}.json`);

  let metadata = null;
  if (await fileExists(sidecarPath)) {
    metadata = safeJsonParse(await fs.readFile(sidecarPath, 'utf8'));
  }

  return parseMarkdownSkill(id, markdown, metadata);
}

async function loadSkillFromDirectory(dirPath) {
  const skillId = path.basename(dirPath);
  const skillPath = path.join(dirPath, 'SKILL.md');
  const skillsDir = path.dirname(dirPath);
  const sidecarPath = path.join(skillsDir, '.metadata', `${skillId}.json`);

  const markdown = await fs.readFile(skillPath, 'utf8');
  
  if (await fileExists(sidecarPath)) {
    const metadata = safeJsonParse(await fs.readFile(sidecarPath, 'utf8'));
    return parseMarkdownSkill(skillId, markdown, metadata);
  }
  
  return parseDirectorySkill(dirPath, markdown);
}

export async function listSkills() {
  const skillsDir = await getSkillsDir();
  await fs.mkdir(skillsDir, { recursive: true });

  const entries = await fs.readdir(skillsDir, { withFileTypes: true });
  const skillsMap = new Map();

  // Sort entries to process directories first (or we can just overwrite in the map)
  // Actually, processing directories last ensures they overwrite files if we use the same ID.
  
  // 1. Process files
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if ((entry.isFile() || entry.isSymbolicLink()) && entry.name.endsWith('.md')) {
      try {
        const entryPath = path.join(skillsDir, entry.name);
        const skill = await loadSkillFromFile(entryPath);
        skillsMap.set(skill.id, skill);
      } catch (err) {
        console.warn(`[skills] Failed to load file skill ${entry.name}:`, err.message);
      }
    }
  }

  // 2. Process directories (Precedence)
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory() || entry.isSymbolicLink()) {
      try {
        const entryPath = path.join(skillsDir, entry.name);
        const skillPath = path.join(entryPath, 'SKILL.md');
        if (await fileExists(skillPath)) {
          const skill = await loadSkillFromDirectory(entryPath);
          skillsMap.set(skill.id, skill);
        }
      } catch (err) {
        console.warn(`[skills] Failed to load directory skill ${entry.name}:`, err.message);
      }
    }
  }

  const skills = Array.from(skillsMap.values());
  skills.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  return skills;
}

export async function getSkillById(skillId) {
  assertSafeId(skillId, 'skillId');
  const skillsDir = await getSkillsDir();
  const dirPath = await safeJoin(skillsDir, skillId);
  if (await fileExists(path.join(dirPath, 'SKILL.md'))) {
    return loadSkillFromDirectory(dirPath);
  }

  const filePath = await safeJoin(skillsDir, `${skillId}.md`);
  if (await fileExists(filePath)) {
    return loadSkillFromFile(filePath);
  }

  {
    const error = new Error(`Skill not found: ${skillId}`);
    error.statusCode = 404;
    throw error;
  }
}

export function validateSkill(skill) {
  const errors = [];
  if (!skill?.id || typeof skill.id !== 'string') errors.push('Skill id is required.');
  if (!skill?.name || typeof skill.name !== 'string') errors.push('Skill name is required.');
  if (!skill?.description || typeof skill.description !== 'string') errors.push('Skill description is required.');
  if (!skill?.prompt_template || typeof skill.prompt_template !== 'string') errors.push('Prompt template is required.');
  if (!Array.isArray(skill?.capabilities)) errors.push('Capabilities must be an array.');
  if (!Array.isArray(skill?.parameters)) errors.push('Parameters must be an array.');
  if (!Array.isArray(skill?.examples)) errors.push('Examples must be an array.');
  return errors;
}

export function renderSkill(skill, params = {}) {
  let rendered = String(skill?.prompt_template || '');
  if (!params || typeof params !== 'object') {
    return rendered;
  }
  for (const [key, value] of Object.entries(params)) {
    if (!isSafeKey(key)) continue;
    const placeholder = `{{${key}}}`;
    if (rendered.includes(placeholder)) {
      rendered = rendered.split(placeholder).join(String(value ?? ''));
    }
  }
  return rendered;
}

export function getTemplate() {
  return {
    id: 'new-skill',
    name: 'New Skill',
    description: 'Description of the new skill',
    capabilities: ['General'],
    prompt_template: 'I want you to {{task}} using {{context}}',
    parameters: [
      { name: 'task', type: 'string', required: true, description: 'The task to perform' },
      { name: 'context', type: 'string', required: true, description: 'Contextual information' }
    ],
    examples: []
  };
}

export async function saveSkill(rawSkill) {
  const skillsDir = await getSkillsDir();
  await fs.mkdir(skillsDir, { recursive: true });
  await fs.mkdir(path.join(skillsDir, '.metadata'), { recursive: true });

  const resolvedId = rawSkill?.id || slugify(rawSkill?.name || rawSkill?.description || 'skill');
  assertSafeId(resolvedId, 'skill id');

  const existing = rawSkill?.id ? await getSkillById(resolvedId).catch(() => null) : null;
  const now = new Date().toISOString();
  const skill = {
    id: resolvedId,
    name: rawSkill.name,
    description: rawSkill.description,
    capabilities: rawSkill.capabilities || [],
    prompt_template: rawSkill.prompt_template || '',
    examples: rawSkill.examples || [],
    parameters: rawSkill.parameters || [],
    version: rawSkill.version || existing?.version || '1.0.0',
    created: rawSkill.created || existing?.created || now,
    updated: now,
  };

  const errors = validateSkill(skill);
  if (errors.length > 0) {
    const error = new Error('Validation failed');
    error.statusCode = 400;
    error.details = errors;
    throw error;
  }

  const skillDirPath = await safeJoin(skillsDir, skill.id);
  await fs.mkdir(skillDirPath, { recursive: true });
  const markdownPath = await safeJoin(skillDirPath, 'SKILL.md');
  const sidecarPath = await safeJoin(skillsDir, '.metadata', `${skill.id}.json`);
  await fs.writeFile(markdownPath, skillToMarkdown(skill), 'utf8');
  await fs.writeFile(sidecarPath, JSON.stringify(metadataFromSkill(skill), null, 2), 'utf8');
  return skill;
}

export async function createSkill({ name, description, prompt_template, capabilities }) {
  return saveSkill({
    id: slugify(name),
    name,
    description,
    prompt_template,
    capabilities: Array.isArray(capabilities) ? capabilities : [],
    parameters: [],
    examples: [],
    version: '1.0.0',
  });
}

export async function updateSkill(skill) {
  return saveSkill(skill);
}

export async function deleteSkill(skillId) {
  assertSafeId(skillId, 'skillId');
  const skillsDir = await getSkillsDir();
  const sidecarPath = await safeJoin(skillsDir, '.metadata', `${skillId}.json`);
  const dirPath = await safeJoin(skillsDir, skillId);
  const filePath = await safeJoin(skillsDir, `${skillId}.md`);

  let found = false;
  if (await fileExists(path.join(dirPath, 'SKILL.md'))) {
    await fs.rm(dirPath, { recursive: true, force: true });
    found = true;
  }
  if (await fileExists(filePath)) {
    await fs.rm(filePath, { force: true });
    found = true;
  }

  if (found) {
    await fs.rm(sidecarPath, { force: true });
  } else {
    const error = new Error(`Skill not found: ${skillId}`);
    error.statusCode = 404;
    throw error;
  }
}

const SAFE_SKILL_ARG_RE = /^[a-zA-Z0-9._:/@-]{1,200}$/;
const SAFE_AGENT_ARG_RE = /^[a-zA-Z0-9._-]{1,64}$/;

function tokenizeSkillsCommand(rawCommand) {
  const command = String(rawCommand || '').trim();
  if (!command || command.length > 500 || /[\0\r\n;|&$`><()\\]/.test(command)) {
    const error = new Error('Invalid characters in skill import command');
    error.statusCode = 400;
    throw error;
  }

  const tokens = [];
  let current = '';
  let quote = null;
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (quote) {
    const error = new Error('Unclosed quote in skill import command');
    error.statusCode = 400;
    throw error;
  }
  if (current) tokens.push(current);
  return tokens;
}

export function parseSkillsImportArgs(rawCommand) {
  const tokens = tokenizeSkillsCommand(rawCommand);
  let idx = 0;

  if (!tokens[idx] || tokens[idx].toLowerCase() !== 'npx') {
    const error = new Error('Skill import only supports commands in the form: npx skills add <repo> --skill <name>');
    error.statusCode = 400;
    throw error;
  }
  idx++;

  let hasYes = false;
  while (idx < tokens.length && (tokens[idx] === '-y' || tokens[idx] === '--yes')) {
    hasYes = true;
    idx++;
  }

  if (tokens[idx] !== 'skills' || tokens[idx + 1] !== 'add') {
    const error = new Error('Skill import only supports commands in the form: npx skills add <repo> --skill <name>');
    error.statusCode = 400;
    throw error;
  }
  idx += 2;

  const repo = tokens[idx];
  if (!repo || repo.startsWith('-') || !SAFE_SKILL_ARG_RE.test(repo)) {
    const error = new Error('Skill import requires a valid repository or package identifier');
    error.statusCode = 400;
    throw error;
  }
  idx++;

  const args = [];
  if (hasYes) args.push('--yes');
  args.push('skills', 'add', repo);

  let hasAgent = false;
  let hasCopy = false;

  while (idx < tokens.length) {
    const tok = tokens[idx];
    if (tok === '--yes' || tok === '-y') {
      if (!hasYes) {
        args.unshift('--yes');
        hasYes = true;
      }
      idx++;
    } else if (tok === '--copy') {
      hasCopy = true;
      args.push('--copy');
      idx++;
    } else if (tok === '--skill' || tok === '-s') {
      const val = tokens[idx + 1];
      if (!val || val.startsWith('-') || !SAFE_SKILL_ARG_RE.test(val)) {
        const error = new Error('Invalid --skill value in skill import command');
        error.statusCode = 400;
        throw error;
      }
      args.push(tok, val);
      idx += 2;
    } else if (tok.startsWith('--skill=')) {
      const val = tok.slice('--skill='.length);
      if (!val || !SAFE_SKILL_ARG_RE.test(val)) {
        const error = new Error('Invalid --skill value in skill import command');
        error.statusCode = 400;
        throw error;
      }
      args.push(tok);
      idx++;
    } else if (tok === '--agent' || tok === '-a') {
      const val = tokens[idx + 1];
      if (!val || val.startsWith('-') || !SAFE_AGENT_ARG_RE.test(val)) {
        const error = new Error('Invalid --agent value in skill import command');
        error.statusCode = 400;
        throw error;
      }
      hasAgent = true;
      args.push(tok, val);
      idx += 2;
    } else if (tok.startsWith('--agent=')) {
      const val = tok.slice('--agent='.length);
      if (!val || !SAFE_AGENT_ARG_RE.test(val)) {
        const error = new Error('Invalid --agent value in skill import command');
        error.statusCode = 400;
        throw error;
      }
      hasAgent = true;
      args.push(tok);
      idx++;
    } else {
      const error = new Error(`Unsupported argument in skill import command: ${tok}`);
      error.statusCode = 400;
      throw error;
    }
  }

  if (!hasYes) args.unshift('--yes');
  if (!hasAgent) args.push('--agent', 'openclaw');
  if (!hasCopy) args.push('--copy');

  return args;
}

export async function getSkillsByCategory(category) {
  const skills = await listSkills();
  const term = String(category || '').toLowerCase();
  return skills.filter((skill) => skill.capabilities.some((item) => String(item).toLowerCase().includes(term)));
}

export async function importSkill(npxCommand) {
  const skillsDir = await getSkillsDir();
  await fs.mkdir(skillsDir, { recursive: true });

  const args = parseSkillsImportArgs(npxCommand);
  console.log(`[SkillsService] Importing skill using command: npx ${args.join(' ')}`);
  
  // Before running the command, list current skills
  const before = await listSkills();
  const importWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'productos-skill-import-'));
  
  try {
    // Run the skills CLI in an isolated workspace without a shell.
    if (process.platform === 'win32') {
      const cmdLine = ['npx.cmd', ...args].join(' ');
      await execFilePromise(process.env.ComSpec || 'cmd.exe', ['/d', '/c', cmdLine], {
        cwd: importWorkspace,
        timeout: 60000,
      });
    } else {
      await execFilePromise('npx', args, {
        cwd: importWorkspace,
        timeout: 60000,
      });
    }

    const importedSkillsDir = path.join(importWorkspace, 'skills');
    if (await fileExists(importedSkillsDir)) {
      const entries = await fs.readdir(importedSkillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        assertSafeId(entry.name, 'imported skill id');
        const source = path.join(importedSkillsDir, entry.name);
        const lstat = await fs.lstat(source);
        if (lstat.isSymbolicLink()) continue;

        const destination = await safeJoin(skillsDir, entry.name);
        if (entry.isDirectory() && await fileExists(path.join(source, 'SKILL.md'))) {
          await fs.rm(destination, { recursive: true, force: true });
          await fs.cp(source, destination, {
            recursive: true,
            filter: async (srcPath) => {
              const st = await fs.lstat(srcPath);
              return !st.isSymbolicLink();
            },
          });
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          await fs.copyFile(source, destination);
        }
      }
    }
    
    // After running, re-list and find the new one
    const after = await listSkills();
    const newlyAdded = after.find(a => !before.some(b => b.id === a.id));
    
    if (newlyAdded) {
      return newlyAdded;
    }
    
    // Fallback: if no new file appeared, maybe it updated an existing one?
    // Return the list and let the UI handle it or return the first skill if the list is small.
    return after[0] || null;
  } catch (error) {
    console.error(`[SkillsService] Import failed: ${error.message}`);
    const err = new Error(`Failed to run import command: ${error.message}`);
    err.statusCode = error.statusCode || 500;
    throw err;
  } finally {
    await fs.rm(importWorkspace, { recursive: true, force: true });
  }
}
