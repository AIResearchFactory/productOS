/**
 * entity-extractor.mjs
 * Extracts entities (names, mentions, URLs) and keywords from text content.
 */

/**
 * Heuristic entity and keyword extraction.
 * 
 * @param {string} content - Document text content
 * @returns {{ entities: string[], keywords: string[] }}
 */
export function extractEntitiesHeuristic(content) {
  if (!content || typeof content !== 'string') {
    return { entities: [], keywords: [] };
  }

  const entities = new Set();
  const keywords = new Set();

  // 1. Capitalized multi-word terms (e.g. "Product Hunt", "Silent Learner")
  const capitalizedRegex = /\b[A-Z][a-zA-Z0-9_-]*(?:\s+[A-Z][a-zA-Z0-9_-]*)+\b/g;
  let match;
  while ((match = capitalizedRegex.exec(content)) !== null) {
    entities.add(match[0].trim());
  }

  // 1.5 Single capitalized words (proper nouns)
  const singleWordRegex = /\b[A-Z][a-zA-Z0-9_-]{2,}\b/g;
  const capitalizedStopwords = new Set([
    'The', 'This', 'That', 'These', 'Those', 'Here', 'There', 'What', 'Where', 'When', 'Why',
    'How', 'Who', 'Which', 'And', 'But', 'If', 'Then', 'Else', 'For', 'With',
    'From', 'To', 'At', 'By', 'In', 'On', 'About', 'Of', 'Is', 'Are', 'Was', 'Were', 'Be', 'Been',
    'We', 'You', 'They', 'Their', 'Its'
  ]);
  while ((match = singleWordRegex.exec(content)) !== null) {
    const word = match[0].trim();
    if (!capitalizedStopwords.has(word)) {
      entities.add(word);
    }
  }

  // 2. @mentions (e.g. "@competitor-x", "@team-lead")
  const mentionRegex = /@[a-zA-Z0-9_-]+/g;
  while ((match = mentionRegex.exec(content)) !== null) {
    entities.add(match[0].trim());
  }

  // 3. URLs (e.g. "https://example.com")
  const urlRegex = /https?:\/\/[^\s)\]},"'`]+/g;
  while ((match = urlRegex.exec(content)) !== null) {
    let url = match[0];
    // Strip trailing punctuation
    while (url && /[.,;:!?]$/.test(url)) {
      url = url.slice(0, -1);
    }
    if (url) {
      entities.add(url);
    }
  }

  // 4. Keywords (headings and bold text)
  const headingRegex = /^#+\s+(.+)$/gm;
  while ((match = headingRegex.exec(content)) !== null) {
    const term = match[1].trim();
    if (term) keywords.add(term);
  }

  const boldRegex = /\*\*([^*]+)\*\*/g;
  while ((match = boldRegex.exec(content)) !== null) {
    const term = match[1].trim();
    if (term && term.length < 50) keywords.add(term);
  }

  return {
    entities: Array.from(entities),
    keywords: Array.from(keywords)
  };
}

/**
 * AI-based metadata extraction with heuristic fallback.
 * 
 * @param {string} content - Document text content
 * @param {object} [provider] - AI provider instance
 * @returns {Promise<{ entities: string[], keywords: string[], summary: string, tags: string[] }>}
 */
export async function extractEntitiesAI(content, provider) {
  if (!provider) {
    const heuristics = extractEntitiesHeuristic(content);
    return {
      entities: heuristics.entities,
      keywords: heuristics.keywords,
      summary: '',
      tags: []
    };
  }

  try {
    const prompt = `You are a metadata extraction system. Analyze the following document and extract:
1. Entities: Named entities, product names, competitors, technologies, etc.
2. Keywords: Core themes, important terms.
3. Summary: A concise, one-line summary (maximum 160 characters).
4. Tags: 3 to 5 high-level category tags.

Respond ONLY with a valid JSON object matching this schema:
{
  "entities": ["string"],
  "keywords": ["string"],
  "summary": "string",
  "tags": ["string"]
}

Document content:
${content}`;

    const res = await provider.chat({
      system_prompt: 'You extract JSON metadata from documents.',
      messages: [{ role: 'user', content: prompt }]
    });

    let jsonStr = res.content.trim();
    // Clean markdown code blocks if present
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?/, '').replace(/```$/, '').trim();
    }
    
    const data = JSON.parse(jsonStr);
    return {
      entities: Array.isArray(data.entities) ? data.entities : [],
      keywords: Array.isArray(data.keywords) ? data.keywords : [],
      summary: typeof data.summary === 'string' ? data.summary : '',
      tags: Array.isArray(data.tags) ? data.tags : []
    };
  } catch (error) {
    console.error('[EntityExtractor] AI extraction failed, falling back to heuristics:', error.message);
    const heuristics = extractEntitiesHeuristic(content);
    return {
      entities: heuristics.entities,
      keywords: heuristics.keywords,
      summary: '',
      tags: []
    };
  }
}
