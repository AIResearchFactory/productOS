/**
 * knowledge-builder.mjs
 * Silent Learner Knowledge Builder Subsystem.
 * 
 * Auto-synthesizes compounding knowledge pages, distilled lessons, and syntheses
 * under the project's .metadata/ directory (.metadata/knowledge, .metadata/lessons).
 * 
 * Core Principles:
 *  - User workspace files remain 100% pristine and untouched.
 *  - System knowledge lives in .metadata/ (e.g. .metadata/knowledge/mobile-ux.md).
 *  - Explicit @ mentions receive double weighting (1 @ mention = 2 occurrence points vs 1 for implicit).
 *  - Offline synthesis uses heuristic extraction with enrichmentLevel: "heuristic".
 *  - When an AI provider is active, reenrichKnowledgePages() upgrades pages to enrichmentLevel: "full".
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { getProjectById } from '../projects.mjs';
import { safeJoin, getMetadataKnowledgeDir, getMetadataLessonsDir, getMetadataSynthesesDir, getGlobalSettingsPath, getSecretsPath } from '../paths.mjs';
import { EncryptionService } from '../encryption.mjs';
import { AIService } from '../ai.mjs';
import * as Store from './learning-store.mjs';

/**
 * Slugify entity name for safe file system usage.
 * @param {string} name 
 * @returns {string}
 */
export function slugify(name) {
  if (!name || typeof name !== 'string') return 'unnamed-concept';
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'unnamed-concept';
}

/**
 * Read global settings from app data.
 */
async function readGlobalSettings() {
  const settingsPath = await getGlobalSettingsPath();
  try {
    return JSON.parse(await fs.readFile(settingsPath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return {};
    throw error;
  }
}

/**
 * Read secrets for AI service.
 */
async function readSecrets() {
  const secretsPath = await getSecretsPath();
  try {
    const encryptedData = await fs.readFile(secretsPath, 'utf8');
    return JSON.parse(EncryptionService.decrypt(encryptedData));
  } catch (error) {
    if (error?.code === 'ENOENT') return {};
    if (process.env.NODE_ENV === 'test' || process.env.ALLOW_UNENCRYPTED_SECRETS_FOR_TESTS === 'true') {
      try {
        return JSON.parse(await fs.readFile(secretsPath, 'utf8'));
      } catch {
        return {};
      }
    }
    return {};
  }
}

/**
 * Aggregate occurrences for entities across learning events and sidecars.
 * Weights:
 *   - Explicit @ mentions: 2 points
 *   - Implicit mentions: 1 point
 * 
 * @param {string} projectId 
 * @returns {Promise<Map<string, { name: string, points: number, sources: Set<string>, atMentionsCount: number, implicitCount: number }>>}
 */
export async function calculateEntityWeights(projectId) {
  const db = await Store.getDatabase(projectId);
  const events = db.prepare('SELECT * FROM learning_events ORDER BY created_at DESC LIMIT 200').all();

  const entityMap = new Map();

  for (const ev of events) {
    let touched = [];
    try {
      touched = JSON.parse(ev.files_touched || '[]');
    } catch {
      touched = [];
    }

    let meta = {};
    try {
      meta = JSON.parse(ev.metadata || '{}');
    } catch {
      meta = {};
    }

    const atMentions = new Set(meta.atMentions || []);

    for (const file of touched) {
      const isAt = atMentions.has(file);
      const points = isAt ? 2 : 1;

      // Deriving entity name from file basename or slug
      const name = path.basename(file, path.extname(file)).replace(/[-_]/g, ' ');
      const key = slugify(name);

      if (!entityMap.has(key)) {
        entityMap.set(key, {
          name,
          points: 0,
          sources: new Set(),
          atMentionsCount: 0,
          implicitCount: 0,
        });
      }

      const record = entityMap.get(key);
      record.points += points;
      record.sources.add(file);
      if (isAt) record.atMentionsCount++;
      else record.implicitCount++;
    }
  }

  return entityMap;
}

/**
 * Build or update compounding knowledge pages in .metadata/knowledge/ for qualifying entities.
 * 
 * @param {string} projectId 
 * @param {object} [options]
 * @param {number} [options.minPoints=3] - Minimum weighted points required for synthesis
 * @returns {Promise<{ created: number, updated: number, skipped: number, pages: string[] }>}
 */
export async function buildCompoundingKnowledge(projectId, options = {}) {
  const minPoints = options.minPoints ?? 3;
  const project = await getProjectById(projectId);
  const knowledgeDir = getMetadataKnowledgeDir(project.path);
  await fs.mkdir(knowledgeDir, { recursive: true });

  const entityWeights = await calculateEntityWeights(projectId);
  const settings = await readGlobalSettings();
  const secrets = await readSecrets();
  const providerType = settings.activeProvider || settings.active_provider;
  const hasAiProvider = providerType && AIService.isSupportedProvider(providerType, settings);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const pages = [];

  for (const [slug, entity] of entityWeights.entries()) {
    if (entity.points < minPoints) {
      skipped++;
      continue;
    }

    const pagePath = path.join(knowledgeDir, `${slug}.md`);
    const sidecarPath = path.join(knowledgeDir, `${slug}.json`);
    const sources = Array.from(entity.sources);
    const exists = await fs.access(pagePath).then(() => true).catch(() => false);

    let content = '';
    let enrichmentLevel = 'heuristic';

    if (hasAiProvider) {
      try {
        const provider = await AIService.createProvider(providerType, { ...settings, projectPath: project.path }, secrets);
        const prompt = `Synthesize a comprehensive, high-density technical/product knowledge page for entity: "${entity.name}".
Associated source references: ${sources.join(', ')}.
Total weighted interest score: ${entity.points} (${entity.atMentionsCount} explicit @ mentions, ${entity.implicitCount} implicit occurrences).

Respond with structured markdown including:
# Knowledge: ${entity.name}
## Overview & Core Concepts
## Detailed Findings & Synthesized Rules
## Key References & Source Connections`;

        const response = await provider.chat({
          messages: [{ role: 'user', content: prompt }],
          system_prompt: 'You are an autonomous knowledge maintainer synthesizing persistent project documentation.',
          options: { temperature: 0.2 },
        });

        if (response?.content) {
          content = response.content.trim();
          enrichmentLevel = 'full';
        }
      } catch (err) {
        console.warn(`[KnowledgeBuilder] AI synthesis failed for ${slug}, falling back to heuristic:`, err.message);
      }
    }

    // Heuristic fallback if AI unavailable or failed
    if (!content) {
      content = `# Knowledge: ${entity.name}\n\n` +
        `> Auto-generated knowledge synthesis derived from interaction patterns.\n\n` +
        `## Overview\n` +
        `This knowledge topic represents **${entity.name}** across ${entity.sources.size} project sources.\n\n` +
        `## Metrics & Trust Signals\n` +
        `- Total Weighted Score: ${entity.points}\n` +
        `- Explicit @ Mentions: ${entity.atMentionsCount}\n` +
        `- Implicit References: ${entity.implicitCount}\n\n` +
        `## Associated Source Files\n` +
        sources.map(s => `- \`${s}\``).join('\n');
      enrichmentLevel = 'heuristic';
    }

    await fs.writeFile(pagePath, content, 'utf8');

    const sidecar = {
      id: `.metadata/knowledge/${slug}.md`,
      artifactType: 'knowledge',
      title: `Knowledge: ${entity.name}`,
      description: `Auto-synthesized compounding knowledge page for ${entity.name}`,
      tags: ['auto-knowledge', slug],
      resource: `.metadata/knowledge/${slug}.md`,
      sourceRefs: sources,
      citations: sources.map(s => ({ source: s, relevance: 1.0 })),
      projectId,
      created: exists ? undefined : new Date().toISOString(),
      updated: new Date().toISOString(),
      silentLearner: {
        confidence: Math.min(1.0, 0.5 + entity.points * 0.1),
        usageConsistency: 0.8,
        recencyScore: 1.0,
        taskAlignment: 0.9,
        compositeScore: Math.min(1.0, 0.6 + entity.points * 0.08),
        lastObserved: new Date().toISOString(),
        relatedConcepts: [slug],
        enrichmentLevel,
        enrichedAt: new Date().toISOString(),
        atMentionsCount: entity.atMentionsCount,
        weightedPoints: entity.points,
      },
    };

    if (exists) {
      try {
        const prevSidecar = JSON.parse(await fs.readFile(sidecarPath, 'utf8'));
        sidecar.created = prevSidecar.created || new Date().toISOString();
      } catch { /* ignore */ }
      updated++;
    } else {
      sidecar.created = new Date().toISOString();
      created++;
    }

    await fs.writeFile(sidecarPath, JSON.stringify(sidecar, null, 2), 'utf8');
    pages.push(`.metadata/knowledge/${slug}.md`);
  }

  return { created, updated, skipped, pages };
}

/**
 * Re-enrich all heuristic knowledge pages in .metadata/knowledge/ using active AI provider.
 * Called when an AI provider becomes available.
 * 
 * @param {string} projectId 
 * @returns {Promise<{ reEnriched: number, skipped: number }>}
 */
export async function reenrichKnowledgePages(projectId) {
  const settings = await readGlobalSettings();
  const secrets = await readSecrets();
  const providerType = settings.activeProvider || settings.active_provider;
  if (!providerType || !AIService.isSupportedProvider(providerType, settings)) {
    return { reEnriched: 0, skipped: 0 };
  }

  const project = await getProjectById(projectId);
  const knowledgeDir = getMetadataKnowledgeDir(project.path);

  let reEnriched = 0;
  let skipped = 0;

  try {
    const files = await fs.readdir(knowledgeDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    for (const jsonFile of jsonFiles) {
      const sidecarPath = path.join(knowledgeDir, jsonFile);
      const mdPath = path.join(knowledgeDir, jsonFile.replace(/\.json$/, '.md'));

      try {
        const sidecar = JSON.parse(await fs.readFile(sidecarPath, 'utf8'));
        if (sidecar.silentLearner?.enrichmentLevel === 'heuristic') {
          // Re-synthesize using AI
          const sources = sidecar.sourceRefs || [];
          const entityName = sidecar.title?.replace(/^Knowledge:\s*/i, '') || sidecar.id;

          const provider = await AIService.createProvider(providerType, { ...settings, projectPath: project.path }, secrets);
          const prompt = `Re-synthesize and deepen technical knowledge page for entity: "${entityName}".
Sources: ${sources.join(', ')}.

Markdown format:
# Knowledge: ${entityName}
## Overview & Core Concepts
## Detailed Findings & Synthesized Rules
## Key References & Source Connections`;

          const response = await provider.chat({
            messages: [{ role: 'user', content: prompt }],
            system_prompt: 'You are an autonomous knowledge maintainer performing deep synthesis upgrade.',
            options: { temperature: 0.2 },
          });

          if (response?.content) {
            await fs.writeFile(mdPath, response.content.trim(), 'utf8');

            sidecar.silentLearner.enrichmentLevel = 'full';
            sidecar.silentLearner.enrichedAt = new Date().toISOString();
            sidecar.updated = new Date().toISOString();

            await fs.writeFile(sidecarPath, JSON.stringify(sidecar, null, 2), 'utf8');
            reEnriched++;
          }
        } else {
          skipped++;
        }
      } catch {
        skipped++;
      }
    }
  } catch {
    // Directory doesn't exist yet
  }

  return { reEnriched, skipped };
}

/**
 * List all compiled knowledge pages in .metadata/knowledge/ with their sidecars.
 * 
 * @param {string} projectId 
 * @returns {Promise<Array<{ id: string, title: string, path: string, sidecar: object }>>}
 */
export async function listKnowledgePages(projectId) {
  const project = await getProjectById(projectId);
  const knowledgeDir = getMetadataKnowledgeDir(project.path);
  const results = [];

  try {
    const files = await fs.readdir(knowledgeDir);
    const mdFiles = files.filter(f => f.endsWith('.md'));

    for (const file of mdFiles) {
      const slug = path.basename(file, '.md');
      const mdPath = path.join(knowledgeDir, file);
      const jsonPath = path.join(knowledgeDir, `${slug}.json`);

      let sidecar = null;
      try {
        sidecar = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
      } catch { /* missing sidecar */ }

      results.push({
        id: `.metadata/knowledge/${file}`,
        slug,
        title: sidecar?.title || `Knowledge: ${slug}`,
        path: mdPath,
        relPath: `.metadata/knowledge/${file}`,
        sidecar,
      });
    }
  } catch {
    // Return empty list if dir doesn't exist
  }

  return results;
}
