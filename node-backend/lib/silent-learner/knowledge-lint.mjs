/**
 * knowledge-lint.mjs
 * Non-destructive Knowledge Health Diagnostics Engine for Silent Learner.
 * 
 * Performs structural and semantic health checks on project artifacts and .metadata/ knowledge:
 *   1. Orphans: Knowledge pages referencing deleted or missing source files.
 *   2. Stale Sidecars: Sidecars whose content hash does not match the content of their source document.
 *   3. Duplicate Candidates: Artifacts with >0.85 Jaccard/TF similarity.
 *   4. Missing Coverage: High-weight entities (>=3 points) missing a compiled page in .metadata/knowledge/.
 * 
 * All checks are strictly non-destructive diagnostic reports.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { getProjectById } from '../projects.mjs';
import { safeJoin, getMetadataKnowledgeDir } from '../paths.mjs';
import { listKnowledgePages, calculateEntityWeights } from './knowledge-builder.mjs';
import { computeTFSimilarity } from './vector-index.mjs';

/**
 * Run full knowledge health diagnostics for a project.
 * 
 * @param {string} projectId 
 * @returns {Promise<{
 *   healthScore: number,
 *   summary: { totalChecks: number, issuesFound: number },
 *   orphans: Array<{ id: string, file: string, reason: string }>,
 *   staleSidecars: Array<{ file: string, sidecar: string, reason: string }>,
 *   duplicates: Array<{ fileA: string, fileB: string, similarity: number }>,
 *   missingCoverage: Array<{ entity: string, points: number }>
 * }>}
 */
export async function runKnowledgeHealthCheck(projectId) {
  const project = await getProjectById(projectId);

  const [orphans, staleSidecars, duplicates, missingCoverage] = await Promise.all([
    checkOrphans(projectId, project.path),
    checkStaleSidecars(project.path),
    checkDuplicates(project.path),
    checkMissingCoverage(projectId),
  ]);

  const issuesFound = orphans.length + staleSidecars.length + duplicates.length + missingCoverage.length;
  // Compute health score (100 base score, minus weighted penalties)
  const penalty = (orphans.length * 5) + (staleSidecars.length * 2) + (duplicates.length * 8) + (missingCoverage.length * 3);
  const healthScore = Math.max(0, Math.min(100, 100 - penalty));

  return {
    healthScore,
    summary: {
      totalChecks: 4,
      issuesFound,
    },
    orphans,
    staleSidecars,
    duplicates,
    missingCoverage,
  };
}

/**
 * Check for orphaned knowledge pages whose source references no longer exist.
 */
async function checkOrphans(projectId, projectPath) {
  const kPages = await listKnowledgePages(projectId);
  const orphans = [];

  for (const kPage of kPages) {
    const sources = kPage.sidecar?.sourceRefs || [];
    let validSources = 0;

    for (const src of sources) {
      try {
        const fullPath = await safeJoin(projectPath, src);
        await fs.access(fullPath);
        validSources++;
      } catch {
        // Source file doesn't exist
      }
    }

    if (sources.length > 0 && validSources === 0) {
      orphans.push({
        id: kPage.id,
        file: kPage.relPath,
        reason: 'All source reference files have been moved or deleted.',
      });
    }
  }

  return orphans;
}

/**
 * Check for stale sidecars (content hash mismatch).
 */
async function checkStaleSidecars(projectPath) {
  const staleSidecars = [];

  async function scanDir(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          const jsonPath = fullPath.slice(0, -3) + '.json';
          try {
            const sidecarRaw = await fs.readFile(jsonPath, 'utf8');
            const sidecar = JSON.parse(sidecarRaw);
            const content = await fs.readFile(fullPath, 'utf8');
            const currentHash = 'sha256:' + createHash('sha256').update(content).digest('hex');

            if (sidecar.silentLearner?.contentHash && sidecar.silentLearner.contentHash !== currentHash) {
              staleSidecars.push({
                file: path.relative(projectPath, fullPath),
                sidecar: path.relative(projectPath, jsonPath),
                reason: 'Source content hash mismatch. Document edited externally.',
              });
            }
          } catch {
            // Sidecar missing or invalid — handled separately
          }
        }
      }
    } catch {
      // Ignore unreadable dirs
    }
  }

  await scanDir(projectPath);
  return staleSidecars;
}

/**
 * Check for duplicate artifact candidates (>0.85 similarity).
 */
async function checkDuplicates(projectPath) {
  const duplicates = [];
  const mdDocs = [];

  async function collectMdFiles(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await collectMdFiles(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('.')) {
          const content = await fs.readFile(fullPath, 'utf8');
          if (content.trim().length > 100) {
            mdDocs.push({
              relPath: path.relative(projectPath, fullPath),
              content,
            });
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  await collectMdFiles(projectPath);

  // Compare pairs (limit to top 30 files for performance)
  const docsToCompare = mdDocs.slice(0, 30);
  for (let i = 0; i < docsToCompare.length; i++) {
    for (let j = i + 1; j < docsToCompare.length; j++) {
      const docA = docsToCompare[i];
      const docB = docsToCompare[j];
      const similarity = computeTFSimilarity(docA.content, docB.content);
      if (similarity >= 0.85) {
        duplicates.push({
          fileA: docA.relPath,
          fileB: docB.relPath,
          similarity: Math.round(similarity * 100) / 100,
        });
      }
    }
  }

  return duplicates;
}

/**
 * Check for entities with high occurrence weights missing a compiled knowledge page.
 */
async function checkMissingCoverage(projectId) {
  const entityWeights = await calculateEntityWeights(projectId);
  const existingPages = await listKnowledgePages(projectId);
  const existingSlugs = new Set(existingPages.map(p => p.slug));

  const missingCoverage = [];

  for (const [slug, entity] of entityWeights.entries()) {
    if (entity.points >= 3 && !existingSlugs.has(slug)) {
      missingCoverage.push({
        entity: entity.name,
        slug,
        points: entity.points,
      });
    }
  }

  return missingCoverage;
}
