import fs from 'fs';
import path from 'path';
import { getProjectsDir } from './paths.js';
import { loadGlobalSettings } from './settings.js';

/**
 * Port of Rust ArtifactService + models/artifact.rs.
 */

const ARTIFACT_TYPE_DIRS = {
  roadmap: 'roadmaps', product_vision: 'product-visions', one_pager: 'one-pagers',
  prd: 'prds', initiative: 'initiatives', competitive_research: 'competitive-research',
  user_story: 'user-stories', insight: 'insights', presentation: 'presentations', pr_faq: 'pr-faqs'
};

const ARTIFACT_TYPE_NAMES = {
  roadmap: 'Roadmap', product_vision: 'Product Vision', one_pager: 'One Pager',
  prd: 'PRD', initiative: 'Initiative', competitive_research: 'Competitive Research',
  user_story: 'User Story', insight: 'Insight', presentation: 'Presentation', pr_faq: 'PR-FAQ'
};

const ALL_TYPES = Object.keys(ARTIFACT_TYPE_DIRS);

function artifactDir(projectId, artifactType) {
  const projectsPath = getProjectsDir();
  const projectDir = path.join(projectsPath, projectId);
  const targetName = ARTIFACT_TYPE_DIRS[artifactType];
  if (!targetName) throw new Error(`Unknown artifact type: ${artifactType}`);

  const directPath = path.join(projectDir, targetName);
  if (fs.existsSync(directPath)) return directPath;

  // Case-insensitive fallback
  if (fs.existsSync(projectDir)) {
    for (const entry of fs.readdirSync(projectDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.toLowerCase() === targetName.toLowerCase()) {
        return path.join(projectDir, entry.name);
      }
    }
  }
  return directPath;
}

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function loadArtifactFromDir(dir, id) {
  const mdPath = path.join(dir, `${id}.md`);
  const sidecarPath = path.join(dir, `${id}.json`);
  if (!fs.existsSync(mdPath)) throw new Error(`Markdown file not found: ${mdPath}`);
  
  const content = fs.readFileSync(mdPath, 'utf-8');
  if (!fs.existsSync(sidecarPath)) throw new Error(`Sidecar JSON not found: ${sidecarPath}`);

  const sidecar = JSON.parse(fs.readFileSync(sidecarPath, 'utf-8'));
  return { ...sidecar, content, path: dir };
}

function saveArtifact(artifact) {
  fs.mkdirSync(artifact.path, { recursive: true });
  const mdPath = path.join(artifact.path, `${artifact.id}.md`);
  const sidecarPath = path.join(artifact.path, `${artifact.id}.json`);

  fs.writeFileSync(mdPath, artifact.content, 'utf-8');

  const { content: _c, path: _p, ...sidecar } = artifact;
  fs.writeFileSync(sidecarPath, JSON.stringify(sidecar, null, 2), 'utf-8');
}

export function createArtifact(projectId, artifactType, title) {
  const dir = artifactDir(projectId, artifactType);
  fs.mkdirSync(dir, { recursive: true });

  const id = slugify(title);
  const now = new Date().toISOString();
  const artifact = {
    id, artifactType, title, content: '', projectId,
    sourceRefs: [], confidence: null,
    created: now, updated: now, metadata: {}, path: dir
  };
  artifact.content = getTemplateContent(artifact);
  saveArtifact(artifact);
  return artifact;
}

export function loadArtifact(projectId, artifactType, artifactId) {
  const dir = artifactDir(projectId, artifactType);
  return loadArtifactFromDir(dir, artifactId);
}

export function listArtifacts(projectId, artifactType) {
  const typesToScan = artifactType ? [artifactType] : ALL_TYPES;
  const artifacts = [];

  for (const at of typesToScan) {
    let dir;
    try { dir = artifactDir(projectId, at); } catch { continue; }
    if (!fs.existsSync(dir)) continue;

    // Recursively find all .md files
    function walk(d) {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const fullPath = path.join(d, entry.name);
        if (entry.isDirectory()) { walk(fullPath); continue; }
        if (!entry.name.endsWith('.md')) continue;
        const id = entry.name.replace(/\.md$/, '');
        const parentDir = path.dirname(fullPath);
        try {
          artifacts.push(loadArtifactFromDir(parentDir, id));
        } catch {
          // Manually added markdown without sidecar — create one
          const content = fs.readFileSync(fullPath, 'utf-8');
          const title = extractSmartTitle(content, at) ||
            (content.split('\n').find(l => l.startsWith('# '))?.replace(/^# /, '').trim()) || id;
          const now = new Date().toISOString();
          const artifact = {
            id, artifactType: at, title, content, projectId,
            sourceRefs: [], confidence: null,
            created: now, updated: now, metadata: {}, path: parentDir
          };
          saveArtifact(artifact);
          artifacts.push(artifact);
        }
      }
    }
    walk(dir);
  }

  artifacts.sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
  return artifacts;
}

export function updateArtifactContent(projectId, artifactType, artifactId, content) {
  const artifact = loadArtifact(projectId, artifactType, artifactId);
  artifact.content = content;
  artifact.updated = new Date().toISOString();
  saveArtifact(artifact);
  return artifact;
}

export function updateArtifactMetadata(projectId, artifactType, artifactId, title, confidence) {
  const artifact = loadArtifact(projectId, artifactType, artifactId);
  let changed = false;
  if (title && title !== artifact.title) { artifact.title = title; changed = true; }
  if (confidence !== undefined && confidence !== artifact.confidence) { artifact.confidence = confidence; changed = true; }
  if (changed) { artifact.updated = new Date().toISOString(); saveArtifact(artifact); }
}

export function deleteArtifact(projectId, artifactType, artifactId) {
  const dir = artifactDir(projectId, artifactType);
  const mdPath = path.join(dir, `${artifactId}.md`);
  const jsonPath = path.join(dir, `${artifactId}.json`);
  if (fs.existsSync(mdPath)) fs.unlinkSync(mdPath);
  if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
}

function extractSmartTitle(content, artifactType) {
  const h1 = content.split('\n').find(l => l.startsWith('# '))?.replace(/^# /, '').trim();
  if (artifactType === 'presentation' && h1) {
    const h2 = content.split('\n').find(l => l.startsWith('## ') && !/goal|outline/i.test(l))?.replace(/^## /, '').trim();
    return h2 ? `${h1} — ${h2}` : h1;
  }
  return h1 || null;
}

function getTemplateContent(artifact) {
  const typeKey = artifact.artifactType;
  const projectsPath = getProjectsDir();
  // Check local project template
  const localTemplate = path.join(projectsPath, artifact.projectId, '.templates', `${typeKey}.md`);
  if (fs.existsSync(localTemplate)) {
    return fs.readFileSync(localTemplate, 'utf-8').replace(/\{\{title\}\}/g, artifact.title);
  }
  // Check global template
  try {
    const settings = loadGlobalSettings();
    if (settings.artifactTemplates?.[typeKey]) {
      return settings.artifactTemplates[typeKey].replace(/\{\{title\}\}/g, artifact.title);
    }
  } catch { /* ignore */ }
  return defaultContent(artifact);
}

function defaultContent(artifact) {
  const t = artifact.title;
  const templates = {
    roadmap: `# ${t}\n\n## Vision\nDetailed vision for the product's mid-to-long term future.\n\n## Strategic Goals (SMART)\n- **Goal 1**: Describe objective and target date.\n\n## Key Themes & Initiatives\n### [Theme A]\n- **Initiative 1**: Brief description.\n\n## Timeline / Phases\n- **Now**: High-certainty items.\n- **Next**: Planned items.\n- **Later**: Future explorations.\n\n## Success Metrics\nHow will we measure success?`,
    product_vision: `# ${t}\n\n## The Problem\nWhat is the core problem we are solving?\n\n## Target Audience\nWho are we building this for?\n\n## Vision Statement\nA concise, inspiring statement.\n\n## Key Differentiators\nWhat sets this apart?\n\n## Expected Outcomes\nWhat does success look like?`,
    one_pager: `# ${t}\n\n## Overview\nA brief summary of the proposal.\n\n## Problem Statement\nThe specific customer pain point.\n\n## Proposed Solution\nHigh-level description.\n\n## Key Benefits\n- **Benefit 1**: Description.\n\n## Success Criteria\nWhat does success look like?`,
    prd: `# ${t}\n\n## Overview\nContext and background.\n\n## Goals & Objectives\nWhat are we trying to achieve?\n\n## User Stories\n- As a [user], I want [action] so that [value].\n\n## Functional Requirements\nDetailed list of must-have functionalities.\n\n## Non-Functional Requirements\nPerformance, security, scalability.\n\n## Success Metrics (KPIs)\nHow will we track performance?`,
    initiative: `# ${t}\n\n## Objective\nPrimary goal of this initiative.\n\n## Strategic Context\nHow does this align with the roadmap?\n\n## Desired Outcomes\nMeasurable results expected.\n\n## High-Level Requirements\nKey features or changes needed.`,
    competitive_research: `# ${t}\n\n## Objectives\nWhy are we conducting this analysis?\n\n## Competitors\n### [Competitor A]\n- **Strengths**: ...\n- **Weaknesses**: ...\n\n## SWOT Analysis\n- **Strengths**: ...\n- **Opportunities**: ...\n\n## Actionable Insights\nRecommendations.`,
    user_story: `# ${t}\n\n## Story\nAs a **[user type]**, I want **[action]** so that **[benefit]**.\n\n## Acceptance Criteria\n- [ ] Criterion 1\n- [ ] Criterion 2\n\n## Notes & Constraints\nTechnical or design limitations.`,
    insight: `# ${t}\n\n## Observation\nWhat data or feedback was observed?\n\n## Source\nWhere did this come from?\n\n## Meaning & Impact\nWhat does this mean for the product?\n\n## Recommendation\nProposed action items.`,
    presentation: `# ${t}\n\n## Presentation Goal\nWhat is the main message?\n\n## Target Audience\nWho are you presenting to?\n\n## Outline\n1. Introduction\n2. Current Progress\n3. Future Strategy\n4. Call to Action`,
    pr_faq: `# ${t}\n\n## Press Release\n**FOR IMMEDIATE RELEASE**\n\n### Introduction\nOne-sentence summary.\n\n### Problem\nWhat customer problem does this address?\n\n### Solution\nHow does the product solve it?\n\n## External FAQ\n### 1. [Question]?\n[Answer]\n\n## Internal FAQ\n### 1. [Question]?\n[Answer]`
  };
  return templates[artifact.artifactType] || `# ${t}\n\nContent goes here.`;
}

export { ARTIFACT_TYPE_DIRS, ARTIFACT_TYPE_NAMES, ALL_TYPES };
