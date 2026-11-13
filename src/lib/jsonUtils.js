/**
 * Robust JSON extraction, cleaning, and repair utilities for LLM outputs.
 */

/**
 * Attempts to repair incomplete or malformed JSON strings produced by streaming or LLMs.
 * @param {string} jsonStr
 * @returns {string}
 */
export function repairJson(jsonStr) {
  let cleaned = String(jsonStr || '').trim();
  if (!cleaned) return '{}';

  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    // Proceed to repair
  }

  // Strip leading non-json chars
  const firstBrace = cleaned.search(/[{\[]/);
  if (firstBrace > 0) {
    cleaned = cleaned.slice(firstBrace);
  }

  let inString = false;
  let escape = false;
  const stack = [];
  let repaired = '';

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (inString) {
      if (escape) {
        escape = false;
        repaired += char;
      } else if (char === '\\') {
        escape = true;
        repaired += char;
      } else if (char === '"') {
        inString = false;
        repaired += char;
      } else if (char === '\n') {
        repaired += '\\n';
      } else if (char === '\r') {
        repaired += '\\r';
      } else if (char === '\t') {
        repaired += '\\t';
      } else {
        repaired += char;
      }
    } else {
      if (char === '"') {
        inString = true;
        repaired += char;
      } else if (char === '{') {
        stack.push('{');
        repaired += char;
      } else if (char === '}') {
        if (stack[stack.length - 1] === '{') {
          stack.pop();
          repaired += char;
          if (stack.length === 0) {
            // Outermost object closed! Ignore any trailing text outside JSON
            break;
          }
        }
      } else if (char === '[') {
        stack.push('[');
        repaired += char;
      } else if (char === ']') {
        if (stack[stack.length - 1] === '[') {
          stack.pop();
          repaired += char;
          if (stack.length === 0) {
            // Outermost array closed! Ignore any trailing text outside JSON
            break;
          }
        }
      } else {
        repaired += char;
      }
    }
  }

  if (inString) {
    if (escape) {
      repaired = repaired.slice(0, -1);
    }
    repaired += '"';
  }

  repaired = repaired.trim();

  if (repaired.endsWith(':')) {
    repaired += '""';
  }

  repaired = repaired.replace(/,(\s*)$/, '$1');

  while (stack.length > 0) {
    const open = stack.pop();
    if (open === '{') {
      repaired += '}';
    } else if (open === '[') {
      repaired += ']';
    }
  }

  return repaired;
}

/**
 * Cleans markdown code fences, surrounding commentary, and unescaped characters from raw JSON.
 * @param {string} raw
 * @returns {string}
 */
export function cleanJsonContent(raw) {
  if (!raw || !String(raw).trim()) return '{}';

  let text = String(raw).trim();

  // 1. Strip markdown code block fences if present anywhere in the string
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    text = codeBlockMatch[1].trim();
  } else {
    // If there's an opening ```json but no closing ``` (e.g. streaming or unclosed)
    text = text.replace(/^```[a-zA-Z0-9]*\s*/, '').replace(/```\s*$/, '').trim();
  }

  // 2. Find the first '{' (or '[') to ignore leading non-JSON commentary
  const firstBrace = text.search(/[{\[]/);
  if (firstBrace === -1) {
    return repairJson(text);
  }

  // 3. Scan from firstBrace to find the matching outermost closing brace
  let inString = false;
  let escape = false;
  let depth = 0;
  let extracted = '';

  for (let i = firstBrace; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escape) {
        escape = false;
        extracted += char;
      } else if (char === '\\') {
        escape = true;
        extracted += char;
      } else if (char === '"') {
        inString = false;
        extracted += char;
      } else if (char === '\n') {
        extracted += '\\n';
      } else if (char === '\r') {
        extracted += '\\r';
      } else if (char === '\t') {
        extracted += '\\t';
      } else {
        extracted += char;
      }
    } else {
      if (char === '"') {
        inString = true;
        extracted += char;
      } else if (char === '{' || char === '[') {
        depth++;
        extracted += char;
      } else if (char === '}' || char === ']') {
        depth--;
        extracted += char;
        if (depth === 0) {
          break;
        }
      } else {
        extracted += char;
      }
    }
  }

  let sanitized = extracted.replace(/,(\s*[\]}])/g, '$1');

  try {
    JSON.parse(sanitized);
    return sanitized;
  } catch {
    const repaired = repairJson(sanitized);
    const finalClean = repaired.replace(/,(\s*[\]}])/g, '$1');
    return finalClean;
  }
}

/**
 * Extracts and parses JSON from raw LLM output, with optional fallback value.
 * @template T
 * @param {string} raw
 * @param {T} [fallback]
 * @returns {T}
 */
export function extractAndParseJson(raw, fallback) {
  try {
    const cleaned = cleanJsonContent(raw);
    return JSON.parse(cleaned);
  } catch (err) {
    if (fallback !== undefined) {
      return fallback;
    }
    throw err;
  }
}
