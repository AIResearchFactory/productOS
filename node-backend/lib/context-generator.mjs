/**
 * context-generator.mjs
 * Materializes OKF-compliant Markdown files in <PROJECT_PATH>/.metadata/_context/
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { getProjectById } from './projects.mjs';

async function fileExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function buildIndexContent(projectName) {
  return `---
type: agent_steering
id: index
title: Agent Steering & Project Context Map
description: Primary entry point for AI agents. Defines rule enforcement, template inheritance, sidecar metadata awareness, and reference files for this project.
---

# Agent Steering: Project Context Map for ${projectName}

## 1. Context Entry Point
Upon initialization for any user task in this project, review the following policy and concept files to calibrate your responses:

- **Project Concept**: [Overview](file://project/overview.md)
- **Writing Policy**: [Writing Style & Tone](file://rules/writing-style.md)
- **Brand & Visual Policy**: [Brand Design Guidelines](file://rules/brand-design.md)
- **Domain Terms**: [Preferred Keywords](file://references/keywords.md)
- **Forbidden Terms**: [Keywords to Avoid](file://references/avoided-terms.md)
- **Target Users**: [Personas](file://references/personas.md)
- **Market Context**: [Competitors](file://references/competitors.md)

## 2. File Sidecar Metadata Awareness
- Note that individual project files have corresponding \`.metadata/{filename}.json\` sidecar files containing rich structured metadata (summaries, confidence scores, category tags, usage metrics).
- Consult sidecar metadata to assess file relevance, confidence levels, and summary previews when evaluating project context.

## 3. Rule Enforcement Logic
- **Writing Style**: Always apply rules in \`rules/writing-style.md\` for text, documentation, and chat responses.
- **Negative Constraints**: Strictly enforce the banned words and restricted phrases listed in \`references/avoided-terms.md\` and \`rules/writing-style.md\`. Never use forbidden terms.
- **Vocabulary**: Prefer domain-specific terminology listed in \`references/keywords.md\`.
- **Brand Design**: Apply \`rules/brand-design.md\` whenever generating, formatting, or exporting presentation decks or visual layouts.

## 4. Template Inheritance & Guiding Questions
When asked to generate a structured artifact (PRD, Roadmap, User Story, One Pager, Presentation, etc.):

1. **Check Override**: Check if a custom template exists at \`.templates/<type>.md\` in the project root.
2. **Fallback**: If no custom template exists, use the global default template structure for \`<type>\`.
3. **Template-Driven Formatting**: Determine formatting style and density from the active template (e.g. structured bullet criteria for PRDs vs narrative prose for vision documents).
4. **Guiding Questions**: Before producing the final deliverable, review [Guiding Questions](file://templates/guiding-questions.md) and ask the user clarifying questions if key information (personas, JTBD, non-functional requirements) is missing.
5. **Export Readiness**: Ensure all generated content is formatted cleanly for export as professional PM deliverables or slide presentations.
`;
}

function buildOverviewContent(project) {
  const goalText = project.goal ? project.goal.trim() : 'Not specified';
  return `---
type: project_overview
id: project/overview
title: Project Overview & Strategic Goals
description: Core product goals, scope, and project context for AI agents.
---

# Project Overview: ${project.name}

## Core Goal & Purpose
${goalText}

## Scope & Constraints
- **Primary Deliverables**: Structured product management artifacts (PRDs, Roadmaps, User Stories, Insights).
- **Workspace Directory**: Authorized root folder for all project files and research logs.
- **Context Layer**: Maintained automatically in \`.metadata/_context/\`.
- **Sidecar Metadata**: Additional file-specific metadata exists in \`.metadata/{filename}.json\` sidecar files (summaries, confidence scores, tags, usage metrics) and should be used as context when inspecting project files.

## Key References
- [Target Personas](file://../references/personas.md)
- [Competitive Landscape](file://../references/competitors.md)
- [Writing Style Rules](file://../rules/writing-style.md)
`;
}

function buildWritingStyleContent(rulesText) {
  return `---
type: policy
id: rules/writing_style
title: Writing Style & Tone of Voice Policy
description: Rules governing tone, audience, export readiness, and forbidden language.
---

# Policy: Writing Style & Tone of Voice

## Required Tone & Voice
${rulesText.trim()}

## Document Quality & Export Readiness
- Generated deliverables are intended for export as executive documents and presentation decks.
- Maintain professional, publication-ready quality appropriate for product managers and stakeholders.
- Sentence structure, length, and formatting density (narrative vs. concise bullets) are governed by the specific artifact template being executed.

## Negative Constraints (Banned Content)
- Do NOT use terms listed in [Keywords to Avoid](file://../references/avoided-terms.md).
- Avoid vague buzzwords, filler intros, and generic conversational preambles (e.g. "Sure, I would be happy to help with that!").
- Jump straight to the structured content.
`;
}

function buildBrandDesignContent(brandText) {
  let formattedJson = brandText.trim();
  try {
    const parsed = JSON.parse(brandText);
    formattedJson = JSON.stringify(parsed, null, 2);
  } catch {
    // If not valid JSON, leave as raw string
  }

  return `---
type: policy
id: rules/brand_design
title: Brand & Visual Design Guidelines
description: Visual design guidelines, color palettes, typography, and brand assets for presentation generation.
---

# Policy: Brand & Visual Design Guidelines

## Visual Voice Constraints
These rules apply to presentation skills, slide deck generation, and visual component formatting.

## Brand Configuration Data
\`\`\`json
${formattedJson}
\`\`\`

## Guidelines for Deck Generation
1. Parse the JSON configuration above for primary, secondary, and accent colors.
2. Apply designated heading and body fonts.
3. Keep slide text minimal and high-density — focus on key data points and clean visual hierarchy when exporting presentations.
`;
}

function buildGuidingQuestionsContent() {
  return `---
type: template_guidelines
id: templates/guiding_questions
title: Artifact Template Guiding Questions
description: Interactive questions AI agents ask before generating specific artifact types.
---

# Template Guiding Questions

When assisting with artifact creation, AI agents review these questions to clarify missing inputs before generating the final document:

## PRD (Product Requirements Document)
1. **Target Personas**: Who are the specific user personas this feature is built for?
2. **Problem & Job-to-be-Done**: What specific problem or Job-to-be-Done (JTBD) are we solving for them with this feature?
3. **Success Metrics**: What are the quantitative KPIs and success criteria?
4. **Scope Boundaries**: What is explicitly in-scope vs. out-of-scope for MVP?
5. **Non-Functional Requirements**:
   - **Performance**: What are the latency, throughput, or response time targets?
   - **Telemetry & Metrics**: What events, logs, or analytics metrics must be emitted?
   - **Security & Privacy**: What auth, secret handling, data encryption, or privacy rules apply?
   - **Accessibility**: What keyboard navigation, screen-reader, or contrast guidelines must be met?

## Roadmap
1. What is the time horizon (quarter, half-year, year)?
2. What are the strategic themes or pillars?
3. What are the high-confidence "Now" items vs exploratory "Later" items?
4. How does this align with company-level OKRs?

## Product Vision
1. What is the core problem this product solves?
2. Who is the primary audience and what are their pain points?
3. What differentiates this from alternatives?
4. What does success look like in 3 years?

## User Story
1. Who is the user persona?
2. What action do they want to perform, and why (benefit)?
3. What are the testable acceptance criteria?
4. Are there edge cases or error states to handle?

## One Pager
1. What is the 1-sentence elevator pitch?
2. What is the expected ROI or business impact?
3. What resources/timeline are required?

## Presentation Outline
1. Who is the target audience (executives, engineering, customers)?
2. What is the single takeaway message?
3. What key evidence or data slides are required?
`;
}

function buildKeywordsContent(keywords) {
  const items = keywords.map(k => `- **${k.trim()}**`).join('\n');
  return `---
type: reference
id: references/keywords
title: Preferred Domain Keywords
description: Preferred terminology, acronyms, and product vocabulary for AI generation.
---

# Preferred Domain Keywords

The AI agent should actively prioritize the following domain terminology when drafting copy and documentation:

${items}
`;
}

function buildAvoidedTermsContent(avoidedKeywords) {
  const items = avoidedKeywords.map(k => `- **${k.trim()}**`).join('\n');
  return `---
type: reference
id: references/avoided_terms
title: Keywords & Phrases to Avoid
description: Forbidden buzzwords, prohibited jargon, and restricted terminology.
---

# Keywords & Phrases to Avoid

The AI agent must NEVER use the following words, phrases, or jargon in generated outputs:

${items}
`;
}

async function syncRootReferences(projectPath, contextDir) {
  const refDir = path.join(contextDir, 'references');
  await fs.mkdir(refDir, { recursive: true });

  const filesToSync = ['personas.md', 'competitors.md'];
  for (const filename of filesToSync) {
    const srcPath = path.join(projectPath, filename);
    const destPath = path.join(refDir, filename);

    if (await fileExists(srcPath)) {
      const content = await fs.readFile(srcPath, 'utf8');
      const header = `---
type: reference
id: references/${filename.replace('.md', '')}
title: ${filename === 'personas.md' ? 'Target Personas' : 'Competitive Landscape'}
description: Direct reference to project ${filename}.
---

`;
      await fs.writeFile(destPath, header + content, 'utf8');
    } else {
      // Clean up reference file if source no longer exists
      if (await fileExists(destPath)) {
        await fs.unlink(destPath).catch(() => {});
      }
    }
  }
}

export async function generateContextDirectory(projectId, settings = {}, project = null) {
  if (!project) {
    project = await getProjectById(projectId).catch(() => null);
  }
  if (!project || !project.path) return null;

  const contextDir = path.join(project.path, '.metadata', '_context');
  await fs.mkdir(path.join(contextDir, 'project'), { recursive: true });
  await fs.mkdir(path.join(contextDir, 'rules'), { recursive: true });
  await fs.mkdir(path.join(contextDir, 'templates'), { recursive: true });
  await fs.mkdir(path.join(contextDir, 'references'), { recursive: true });

  // 1. Generate index.md
  await fs.writeFile(path.join(contextDir, 'index.md'), buildIndexContent(project.name), 'utf8');

  // 2. Generate project/overview.md
  await fs.writeFile(path.join(contextDir, 'project', 'overview.md'), buildOverviewContent(project), 'utf8');

  // 3. Generate rules/writing-style.md
  const rulesPath = path.join(contextDir, 'rules', 'writing-style.md');
  if (settings.personalization_rules?.trim()) {
    await fs.writeFile(rulesPath, buildWritingStyleContent(settings.personalization_rules), 'utf8');
  } else if (await fileExists(rulesPath)) {
    await fs.unlink(rulesPath).catch(() => {});
  }

  // 4. Generate rules/brand-design.md
  const brandPath = path.join(contextDir, 'rules', 'brand-design.md');
  if (settings.brand_settings?.trim()) {
    await fs.writeFile(brandPath, buildBrandDesignContent(settings.brand_settings), 'utf8');
  } else if (await fileExists(brandPath)) {
    await fs.unlink(brandPath).catch(() => {});
  }

  // 5. Generate templates/guiding-questions.md
  await fs.writeFile(path.join(contextDir, 'templates', 'guiding-questions.md'), buildGuidingQuestionsContent(), 'utf8');

  // 6. Generate references/keywords.md
  const kwPath = path.join(contextDir, 'references', 'keywords.md');
  if (Array.isArray(settings.domain_keywords) && settings.domain_keywords.length > 0) {
    await fs.writeFile(kwPath, buildKeywordsContent(settings.domain_keywords), 'utf8');
  } else if (await fileExists(kwPath)) {
    await fs.unlink(kwPath).catch(() => {});
  }

  // 7. Generate references/avoided-terms.md
  const avoidPath = path.join(contextDir, 'references', 'avoided-terms.md');
  if (Array.isArray(settings.avoided_keywords) && settings.avoided_keywords.length > 0) {
    await fs.writeFile(avoidPath, buildAvoidedTermsContent(settings.avoided_keywords), 'utf8');
  } else if (await fileExists(avoidPath)) {
    await fs.unlink(avoidPath).catch(() => {});
  }

  // 8. Sync personas.md and competitors.md from project root
  await syncRootReferences(project.path, contextDir);

  return contextDir;
}

export async function getContextStatus(projectId) {
  const project = await getProjectById(projectId).catch(() => null);
  if (!project || !project.path) {
    return {
      hasPersonas: false,
      hasCompetitors: false,
      hasWritingStyle: false,
      hasBrandDesign: false,
      hasDomainKeywords: false,
      hasAvoidedKeywords: false,
      hasContextIndex: false,
    };
  }

  const contextDir = path.join(project.path, '.metadata', '_context');
  const [hasPersonas, hasCompetitors, hasWritingStyle, hasBrandDesign, hasDomainKeywords, hasAvoidedKeywords, hasContextIndex] = await Promise.all([
    fileExists(path.join(project.path, 'personas.md')),
    fileExists(path.join(project.path, 'competitors.md')),
    fileExists(path.join(contextDir, 'rules', 'writing-style.md')),
    fileExists(path.join(contextDir, 'rules', 'brand-design.md')),
    fileExists(path.join(contextDir, 'references', 'keywords.md')),
    fileExists(path.join(contextDir, 'references', 'avoided-terms.md')),
    fileExists(path.join(contextDir, 'index.md')),
  ]);

  return {
    hasPersonas,
    hasCompetitors,
    hasWritingStyle,
    hasBrandDesign,
    hasDomainKeywords,
    hasAvoidedKeywords,
    hasContextIndex,
  };
}
