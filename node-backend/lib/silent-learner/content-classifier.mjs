/**
 * content-classifier.mjs
 * Heuristic file type classifier for project files and artifacts.
 */

import path from 'node:path';

/**
 * Classifies a file path and its content into an OKF-inspired content type.
 * 
 * @param {string} filePath - Path of the file (can be absolute or relative)
 * @param {string} [content] - Document text content
 * @returns {string} One of: 'research', 'spec', 'notes', 'data', 'report',
 *                   'competitive-analysis', 'meeting-notes', 'transcript',
 *                   'prd', 'roadmap', 'user-story', 'initiative', 'unknown'
 */
export function classifyFileType(filePath, content = '') {
  const normalizedPath = (filePath || '').toLowerCase().replace(/\\/g, '/');
  const filename = path.basename(normalizedPath);
  
  // 1. Check path/filename heuristics (highest priority)
  if (normalizedPath.includes('/prds/') || normalizedPath.startsWith('prds/') || filename.startsWith('prd')) {
    return 'prd';
  }
  if (normalizedPath.includes('/roadmaps/') || normalizedPath.startsWith('roadmaps/') || filename.includes('roadmap')) {
    return 'roadmap';
  }
  if (normalizedPath.includes('/initiatives/') || normalizedPath.startsWith('initiatives/')) {
    return 'initiative';
  }
  if (normalizedPath.includes('/user-stories/') || normalizedPath.startsWith('user-stories/')) {
    return 'user-story';
  }
  if (normalizedPath.includes('/meeting-notes/') || normalizedPath.startsWith('meeting-notes/') || filename.includes('meeting')) {
    return 'meeting-notes';
  }
  if (normalizedPath.includes('/transcripts/') || normalizedPath.startsWith('transcripts/') || filename.includes('transcript')) {
    return 'transcript';
  }
  if (normalizedPath.includes('/competitive-research/') || normalizedPath.startsWith('competitive-research/') || filename.includes('competitor') || filename.includes('competitive')) {
    return 'competitive-analysis';
  }
  if (normalizedPath.includes('/insights/') || normalizedPath.startsWith('insights/')) {
    return 'research';
  }

  // 2. Content pattern heuristics
  if (content && typeof content === 'string') {
    const lowerContent = content.toLowerCase();
    
    // Check specific structural headers and keywords
    if (lowerContent.includes('## attendees') || lowerContent.includes('## action items') || lowerContent.includes('## meeting notes')) {
      return 'meeting-notes';
    }
    if (lowerContent.includes('interviewer:') || lowerContent.includes('speaker 1:') || lowerContent.includes('transcript:')) {
      return 'transcript';
    }
    if (lowerContent.includes('competitor a') || lowerContent.includes('competitor b') || lowerContent.includes('competitive landscape') || lowerContent.includes('swot analysis')) {
      return 'competitive-analysis';
    }
    if (lowerContent.includes('## user stories') || lowerContent.includes('## user story')) {
      return 'spec';
    }
    if (lowerContent.includes('## requirements') || lowerContent.includes('## specification')) {
      return 'spec';
    }
    if (lowerContent.includes('# product requirements document') || lowerContent.includes('## prd ')) {
      return 'prd';
    }
    if (lowerContent.includes('## roadmap') || lowerContent.includes('gantt chart') || lowerContent.includes('## timeline')) {
      return 'roadmap';
    }
    if (lowerContent.includes('## research methodology') || lowerContent.includes('survey results') || lowerContent.includes('research findings')) {
      return 'research';
    }
    if (lowerContent.includes('monthly report') || lowerContent.includes('quarterly review') || lowerContent.includes('key performance indicators') || lowerContent.includes('## kpis')) {
      return 'report';
    }
    if (lowerContent.includes('csv format') || lowerContent.includes('dataset') || lowerContent.includes('data source')) {
      return 'data';
    }
    if (lowerContent.includes('## notes') || lowerContent.includes('## scratchpad') || lowerContent.includes('## thoughts')) {
      return 'notes';
    }
  }

  // 3. Fallback/Unknown
  return 'unknown';
}
