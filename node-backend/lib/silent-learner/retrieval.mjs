/**
 * retrieval.mjs
 * Metadata-filtered retrieval layer for Silent Learner.
 * Retrieves relevant memory packs and file scores to build a compact,
 * optimized context window for AI prompts.
 *
 * Runtime flow:
 *   1. Classify task and workspace context
 *   2. Retrieve relevant memory packs, examples, and tool recipes
 *   3. Build compact context window
 *   4. Return augmented context for injection into system prompt
 */

import { getTopScoredFiles, listMemoryPacks as listPacksFromDb } from './learning-store.mjs';
import { readMemoryPack } from './memory-pack.mjs';
import { batchScore, filterByTier, THRESHOLDS } from './scoring.mjs';
import { getProjectFileContent, getOrGenerateSummary } from './vector-index.mjs';
import path from 'node:path';

/** Maximum token budget for SL context injection. */
const MAX_CONTEXT_TOKENS = 2000;

/** Approximate tokens per character. */
const CHARS_PER_TOKEN = 4;

/**
 * Retrieve the most relevant Silent Learner context for a given task.
 * This is the main entry point called during context assembly.
 *
 * @param {string} projectId
 * @param {object} [options]
 * @param {string} [options.taskDescription] - Current user task/goal for alignment
 * @param {string} [options.activeFile] - Currently active file in the editor
 * @param {string[]} [options.recentFiles] - Recently accessed files
 * @param {number} [options.maxTokens=2000] - Maximum token budget for SL context
 * @returns {Promise<{ contextBlock: string, filesUsed: string[], packsUsed: string[], stats: object }>}
 */
export async function retrieveContext(projectId, options = {}) {
  const {
    taskDescription = '',
    activeFile = null,
    recentFiles = [],
    maxTokens = MAX_CONTEXT_TOKENS,
  } = options;

  const maxChars = maxTokens * CHARS_PER_TOKEN;
  let usedChars = 0;
  const sections = [];
  const filesUsed = [];
  const packsUsed = [];

  // 1. Retrieve and score relevant memory packs
  const packs = await listPacksFromDb(projectId);
  const relevantPacks = packs
    .filter(p => p.relevance_score >= 0.3)
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, 5); // Top 5 most relevant packs

  for (const pack of relevantPacks) {
    const lessons = await readMemoryPack(projectId, pack.pack_type);
    if (lessons.length === 0) continue;

    const packSection = formatPackForContext(pack, lessons, taskDescription);
    if (usedChars + packSection.length > maxChars) break;

    sections.push(packSection);
    usedChars += packSection.length;
    packsUsed.push(pack.pack_type);
  }

  // 2. Retrieve top-scored files for context hints and contents
  const fileScores = await getTopScoredFiles(projectId, 30, 0.3);

  if (fileScores.length > 0) {
    // Re-score with task alignment asynchronously
    const scored = await batchScore(projectId, fileScores, taskDescription);
    const activeContextFiles = filterByTier(scored, 'active_context');

    if (activeContextFiles.length > 0) {
      // Add path hints
      const fileSection = formatFileHints(activeContextFiles.slice(0, 10));
      if (usedChars + fileSection.length <= maxChars) {
        sections.push(fileSection);
        usedChars += fileSection.length;
      }

      // Add actual content (with summarization fallback)
      let fileContentsBlock = '';
      for (const file of activeContextFiles.slice(0, 5)) {
        const content = await getProjectFileContent(projectId, file.filePath);
        if (!content) continue;

        let contentToInject = content;
        if (content.length > 8000) { // ~2000 tokens
          contentToInject = await getOrGenerateSummary(projectId, file.filePath, content);
        }

        const ext = path.extname(file.filePath).slice(1) || 'text';
        const fileBlock = `#### File Content: ${file.filePath}\n\`\`\`${ext}\n${contentToInject}\n\`\`\`\n\n`;

        if (usedChars + fileBlock.length <= maxChars) {
          fileContentsBlock += fileBlock;
          usedChars += fileBlock.length;
          filesUsed.push(file.filePath);
        } else {
          break;
        }
      }

      if (fileContentsBlock) {
        sections.push(fileContentsBlock);
      }
    }
  }

  // 3. Build the context block
  let contextBlock = '';
  if (sections.length > 0) {
    contextBlock = '\n## Silent Learner Context (Local Memory)\n\n';
    contextBlock += 'The following patterns and lessons were learned from previous successful work in this workspace:\n\n';
    contextBlock += sections.join('\n');
  }

  return {
    contextBlock,
    filesUsed,
    packsUsed,
    stats: {
      totalPacks: packs.length,
      packsRetrieved: packsUsed.length,
      filesScored: fileScores.length,
      filesRetrieved: filesUsed.length,
      tokensUsed: Math.ceil(usedChars / CHARS_PER_TOKEN),
      tokenBudget: maxTokens,
    },
  };
}

/**
 * Format a memory pack's lessons into a context-friendly string.
 * Only includes the most relevant lessons to stay within budget.
 *
 * @param {object} pack - Memory pack metadata
 * @param {object[]} lessons - Parsed JSONL lessons
 * @param {string} taskDescription - Current task for filtering
 * @returns {string}
 */
function formatPackForContext(pack, lessons, taskDescription) {
  // Select most recent and relevant lessons (max 5 per pack)
  const selected = lessons
    .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
    .slice(0, 5);

  let output = `### ${pack.name}\n`;

  switch (pack.pack_type) {
    case 'workspace-style':
      output += 'Workspace conventions and patterns:\n';
      for (const lesson of selected) {
        const fileTypes = lesson.patterns?.fileTypes?.join(', ') || 'various';
        output += `- ${lesson.task} pattern: ${fileTypes} files (${lesson.outcome})\n`;
      }
      break;

    case 'testing-patterns':
      output += 'Testing patterns used in this workspace:\n';
      for (const lesson of selected) {
        const testFiles = (lesson.testFiles || []).slice(0, 3).join(', ') || 'various';
        output += `- Test files: ${testFiles}\n`;
      }
      break;

    case 'tool-recipes':
      output += 'Successful tool usage patterns:\n';
      for (const lesson of selected) {
        const steps = lesson.steps || {};
        output += `- ${lesson.task}: ${steps.filesChanged || 0} file changes via ${steps.provider || 'unknown'}\n`;
      }
      break;

    case 'accepted-solutions':
      output += 'Previously accepted solutions:\n';
      for (const lesson of selected) {
        const files = (lesson.files || []).slice(0, 3).join(', ') || 'various';
        output += `- ${lesson.task} → ${files} (${lesson.changeCount || 0} changes)\n`;
      }
      break;

    case 'rejected-patterns':
      output += 'Patterns to avoid (previously rejected/failed):\n';
      for (const lesson of selected) {
        output += `- ${lesson.task}: ${lesson.reason || 'rejected'}\n`;
      }
      break;

    default:
      for (const lesson of selected) {
        output += `- ${lesson.task}: ${lesson.outcome || 'completed'}\n`;
      }
  }

  output += '\n';
  return output;
}

/**
 * Format file score hints for context injection.
 * Tells the AI which files are most relevant in the current workspace.
 *
 * @param {Array<{ filePath: string, score: number, tier: string }>} files
 * @returns {string}
 */
function formatFileHints(files) {
  let output = '### High-Relevance Files\n';
  output += 'These files are frequently used and recently active in this workspace:\n';

  for (const file of files) {
    const relevance = file.score >= 0.8 ? '●●●●●' :
                      file.score >= 0.7 ? '●●●●○' :
                      '●●●○○';
    output += `- ${file.filePath}  ${relevance}\n`;
  }

  output += '\n';
  return output;
}

/**
 * Check if Silent Learner has enough memory to provide useful context.
 * Used to determine whether to fire the "Memory Ready" notification.
 *
 * @param {string} projectId
 * @returns {Promise<{ isReady: boolean, lessonCount: number, packCount: number }>}
 */
export async function checkMemoryReadiness(projectId) {
  const packs = await listPacksFromDb(projectId);
  const relevantPacks = packs.filter(p => p.event_count > 0);
  const totalLessons = relevantPacks.reduce((sum, p) => sum + p.event_count, 0);

  return {
    isReady: totalLessons >= 3, // At least 3 lessons to be useful
    lessonCount: totalLessons,
    packCount: relevantPacks.length,
  };
}
