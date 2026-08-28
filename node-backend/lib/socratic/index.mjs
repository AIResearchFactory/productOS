/**
 * index.mjs
 * Socratic PM Interrogator Engine.
 * Detects high-stakes artifact creation intent and synthesizes context-aware clarification questions.
 */

import { DEFAULT_SOCRATIC_QUESTIONS, formatAssumptionsSection } from './prompts.mjs';

/**
 * Detects whether a prompt or command represents a high-stakes artifact creation request.
 * @param {string} prompt
 * @param {Array<object>} [history]
 * @returns {{ isHighStakesArtifact: boolean, artifactType: 'prd' | 'roadmap' | 'user_story' | 'presentation' | null, topic: string, triggerMode: 'slash_command' | 'intent_detected' | null }}
 */
export function detectSocraticArtifactIntent(prompt = '', history = []) {
  if (!prompt || typeof prompt !== 'string') {
    return { isHighStakesArtifact: false, artifactType: null, topic: '', triggerMode: null };
  }

  const cleanPrompt = prompt.trim();

  // 1. Explicit slash command trigger
  if (cleanPrompt.startsWith('/grill-me') || cleanPrompt.startsWith('/grill')) {
    const topic = cleanPrompt.replace(/^\/grill(?:-me)?\s*/i, '').trim();
    const type = detectArtifactTypeFromText(topic) || 'prd';
    return {
      isHighStakesArtifact: true,
      artifactType: type,
      topic: topic || 'New Product Specification',
      triggerMode: 'slash_command',
    };
  }

  // 2. High-stakes creation intent patterns
  const creationVerb = /(?:create|write|draft|generate|build|compose|scaffold|design)\s+(?:a\s+|an\s+|the\s+)?/i;
  
  // PRD patterns
  const prdPattern = new RegExp(`${creationVerb.source}(?:prd|product\\s+req(?:uirement)?s?\\s+doc(?:ument)?|spec|feature\\s+spec)(?:\\s+for\\s+(.+))?`, 'i');
  let match = prdPattern.exec(cleanPrompt);
  if (match) {
    return {
      isHighStakesArtifact: true,
      artifactType: 'prd',
      topic: match[1]?.trim() || cleanPrompt,
      triggerMode: 'intent_detected',
    };
  }

  // Roadmap patterns
  const roadmapPattern = new RegExp(`${creationVerb.source}(?:roadmap|product\\s+roadmap|release\\s+plan)(?:\\s+for\\s+(.+))?`, 'i');
  match = roadmapPattern.exec(cleanPrompt);
  if (match) {
    return {
      isHighStakesArtifact: true,
      artifactType: 'roadmap',
      topic: match[1]?.trim() || cleanPrompt,
      triggerMode: 'intent_detected',
    };
  }

  // User Story patterns
  const storyPattern = new RegExp(`${creationVerb.source}(?:user\\s+stor(?:y|ies)|story\\s+slice|epic)(?:\\s+for\\s+(.+))?`, 'i');
  match = storyPattern.exec(cleanPrompt);
  if (match) {
    return {
      isHighStakesArtifact: true,
      artifactType: 'user_story',
      topic: match[1]?.trim() || cleanPrompt,
      triggerMode: 'intent_detected',
    };
  }

  // Presentation patterns
  const presentationPattern = new RegExp(`${creationVerb.source}(?:presentation|pitch\\s+deck|slide\\s+deck|slides)(?:\\s+for\\s+(.+))?`, 'i');
  match = presentationPattern.exec(cleanPrompt);
  if (match) {
    return {
      isHighStakesArtifact: true,
      artifactType: 'presentation',
      topic: match[1]?.trim() || cleanPrompt,
      triggerMode: 'intent_detected',
    };
  }

  return { isHighStakesArtifact: false, artifactType: null, topic: '', triggerMode: null };
}

/**
 * Helper to detect artifact type from string.
 * @param {string} text
 * @returns {'prd' | 'roadmap' | 'user_story' | 'presentation' | null}
 */
function detectArtifactTypeFromText(text = '') {
  const lower = text.toLowerCase();
  if (lower.includes('roadmap')) return 'roadmap';
  if (lower.includes('story') || lower.includes('epic')) return 'user_story';
  if (lower.includes('slide') || lower.includes('presentation') || lower.includes('deck')) return 'presentation';
  if (lower.includes('prd') || lower.includes('spec') || lower.includes('req')) return 'prd';
  return null;
}

/**
 * Retrieves calibrated Socratic questions for the given artifact type, filtering out redundant facts.
 * @param {'prd' | 'roadmap' | 'user_story' | 'presentation'} artifactType
 * @param {object} [context]
 * @returns {Array<object>}
 */
export function getSocraticQuestionsForArtifact(artifactType = 'prd', context = {}) {
  const baseQuestions = DEFAULT_SOCRATIC_QUESTIONS[artifactType] || DEFAULT_SOCRATIC_QUESTIONS.prd;
  
  // Filter out questions if context already definitively supplies the answer
  return baseQuestions.filter(q => {
    if (q.category === 'telemetry' && context.hasTelemetryConfig) return false;
    return true;
  });
}

export { formatAssumptionsSection };
