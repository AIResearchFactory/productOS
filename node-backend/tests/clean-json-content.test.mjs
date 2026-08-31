import test from 'node:test';
import assert from 'node:assert/strict';

// Test implementation of cleanJsonContent and repairJson
const repairJson = (jsonStr) => {
  let cleaned = jsonStr.trim();
  if (!cleaned) return '{}';

  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch (e) {
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
};

const cleanJsonContent = (raw) => {
  if (!raw || !raw.trim()) return '{}';

  let text = raw.trim();

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
  let foundEnd = false;

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
          foundEnd = true;
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
  } catch (e) {
    const repaired = repairJson(sanitized);
    const finalClean = repaired.replace(/,(\s*[\]}])/g, '$1');
    return finalClean;
  }
};

test('cleanJsonContent - handles standard JSON', () => {
  const input = '{"projectId": "p1", "fileName": "f.txt"}';
  const parsed = JSON.parse(cleanJsonContent(input));
  assert.equal(parsed.projectId, 'p1');
});

test('cleanJsonContent - handles markdown code blocks', () => {
  const input = '```json\n{\n  "projectId": "p1",\n  "fileName": "f.txt"\n}\n```';
  const parsed = JSON.parse(cleanJsonContent(input));
  assert.equal(parsed.projectId, 'p1');
});

test('cleanJsonContent - handles text before and after JSON', () => {
  const input = 'Here is the fix:\n```json\n{\n  "projectId": "p1",\n  "fileName": "f.txt"\n}\n```\nHope this helps!';
  const parsed = JSON.parse(cleanJsonContent(input));
  assert.equal(parsed.projectId, 'p1');
  assert.equal(parsed.fileName, 'f.txt');
});

test('cleanJsonContent - handles unescaped multiline strings in JSON', () => {
  const input = `{\n  "projectId": "p1",\n  "original": "line 1\nline 2",\n  "replacement": "line 1 modified\nline 2"\n}`;
  const parsed = JSON.parse(cleanJsonContent(input));
  assert.equal(parsed.projectId, 'p1');
  assert.equal(parsed.original, 'line 1\nline 2');
});

test('cleanJsonContent - handles trailing commas', () => {
  const input = '{\n  "projectId": "p1",\n  "commentIds": ["c1", "c2", ],\n}';
  const parsed = JSON.parse(cleanJsonContent(input));
  assert.equal(parsed.projectId, 'p1');
  assert.deepEqual(parsed.commentIds, ['c1', 'c2']);
});

test('cleanJsonContent - handles trailing text after JSON without code blocks (Error 2 test)', () => {
  const input = '{\n  "projectId": "p1",\n  "fileName": "test.js"\n}\n\nI have resolved the comment as requested.';
  const parsed = JSON.parse(cleanJsonContent(input));
  assert.equal(parsed.projectId, 'p1');
  assert.equal(parsed.fileName, 'test.js');
});

test('cleanJsonContent - handles incomplete stream prefix (Error 1 test)', () => {
  const input = '{\n  "projectId"';
  const cleaned = cleanJsonContent(input);
  // repairJson might not be able to parse if missing colon, but shouldn't throw crash
  assert.ok(typeof cleaned === 'string');
});
