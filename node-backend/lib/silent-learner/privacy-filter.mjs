/**
 * privacy-filter.mjs
 * Deterministic secret scanner and data classifier for Silent Learner.
 * Scans text for secrets, PII, and sensitive patterns before any data
 * becomes a learning event. All pattern matching is regex-based (no model inference).
 */

/**
 * Data classification levels (ordered by sensitivity).
 * @enum {string}
 */
export const DataClass = {
  SAFE: 'safe',
  SENSITIVE: 'sensitive',
  SECRET: 'secret',
  PERSONAL: 'personal',
  VENDOR_CONFIDENTIAL: 'vendor-confidential',
  EXCLUDED: 'excluded',
};

/**
 * Deterministic secret patterns.
 * Order matters: more specific patterns (e.g. aws_secret_key, openai_key, anthropic_key,
 * private_key_block) appear before broader fallbacks so overlap deduplication picks the
 * most accurate classification.
 * Each entry: { name, label, pattern, dataClass, severity }
 */
const SECRET_PATTERNS = [
  // API Keys & Tokens
  { name: 'aws_access_key', label: 'AWS Access Key', pattern: /(?<![A-Za-z0-9_-])(?:AKIA|ASIA)[A-Z0-9]{16}(?![A-Za-z0-9_-])/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'aws_secret_key', label: 'AWS Secret Access Key', pattern: /(?<![A-Za-z0-9_-])(?:aws_secret_access_key|secret_key)\s*[=:]\s*(?:["'][A-Za-z0-9/+=]{40}["']|[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=]))/gi, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'github_token', label: 'GitHub Token', pattern: /(?<![A-Za-z0-9_-])gh[pousr]_[A-Za-z0-9_]{36,255}(?![A-Za-z0-9_-])/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'github_fine_grained', label: 'GitHub Fine-Grained Token', pattern: /(?<![A-Za-z0-9_-])github_pat_[A-Za-z0-9_]{22,255}(?![A-Za-z0-9_-])/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'anthropic_key', label: 'Anthropic API Key', pattern: /(?<![A-Za-z0-9_/-])sk-ant-[A-Za-z0-9_-]{32,}(?![A-Za-z0-9_-])/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'openai_key', label: 'OpenAI Legacy API Key', pattern: /(?<![A-Za-z0-9_/-])sk-[A-Za-z0-9]{20,}T3BlbkFJ[A-Za-z0-9]{20,}(?![A-Za-z0-9_-])/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'openai_key_v2', label: 'OpenAI API Key', pattern: /(?<![A-Za-z0-9_/-])sk-(?!ant-)(?:(?:proj|svcacct|admin)-)?[A-Za-z0-9_-]{32,}(?![A-Za-z0-9_-])/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'google_api_key', label: 'Google API Key', pattern: /(?<![A-Za-z0-9_-])AIza[A-Za-z0-9_-]{35}(?![A-Za-z0-9_-])/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'slack_token', label: 'Slack Token', pattern: /(?<![A-Za-z0-9_-])xox[bposaer]-[0-9]{10,13}-[A-Za-z0-9-]{24,}(?![A-Za-z0-9_-])/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'stripe_key', label: 'Stripe API Key', pattern: /(?<![A-Za-z0-9_-])(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{24,}(?![A-Za-z0-9_-])/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'jwt_token', label: 'JSON Web Token (JWT)', pattern: /(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}(?![A-Za-z0-9_-])/g, dataClass: DataClass.SECRET, severity: 'high' },
  { name: 'generic_secret', label: 'Generic Secret / API Key Assignment', pattern: /(?<![A-Za-z0-9_-])(?:api[_-]?key|api[_-]?secret|access[_-]?token|auth[_-]?token|secret[_-]?key|private[_-]?key)\s*[=:]\s*["']?[A-Za-z0-9_\-.+=\/]{16,}["']?/gi, dataClass: DataClass.SECRET, severity: 'high' },
  { name: 'bearer_token', label: 'Bearer Auth Token', pattern: /(?<![A-Za-z0-9_-])Bearer\s+[A-Za-z0-9_\-.+=\/]{20,}(?![A-Za-z0-9_\-.+=\/])/g, dataClass: DataClass.SECRET, severity: 'high' },
  { name: 'private_key_block', label: 'Private Key Block', pattern: /-----BEGIN\s+(?:[A-Z0-9 ]+\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:[A-Z0-9 ]+\s+)?PRIVATE\s+KEY-----/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'private_key_header', label: 'Private Key Header', pattern: /-----BEGIN\s+(?:[A-Z0-9 ]+\s+)?PRIVATE\s+KEY-----/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'connection_string', label: 'Database / Service Connection String', pattern: /(?<![A-Za-z0-9+.-])(?:postgres|mysql|mongodb|redis):\/\/[^\s'"]+:[^\s'"]+@[^\s'"]+/gi, dataClass: DataClass.SECRET, severity: 'critical' },

  // PII patterns
  { name: 'email_address', label: 'Email Address', pattern: /(?<![a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?![a-zA-Z0-9.-])/g, dataClass: DataClass.PERSONAL, severity: 'medium' },
  { name: 'phone_number', label: 'Phone Number', pattern: /(?<![A-Za-z0-9_-])(?:\+?1[-.\s])?(?:\([0-9]{3}\)[-.\s]?|[0-9]{3}[-.\s])[0-9]{3}[-.\s][0-9]{4}(?![A-Za-z0-9_-]|\.\d)/g, dataClass: DataClass.PERSONAL, severity: 'medium' },
  { name: 'ssn', label: 'Social Security Number (SSN)', pattern: /(?<![A-Za-z0-9_-])\d{3}-\d{2}-\d{4}(?![A-Za-z0-9_-])/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'credit_card', label: 'Credit Card Number', pattern: /(?<![A-Za-z0-9_-])(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})(?![A-Za-z0-9_-])/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'ip_address', label: 'IPv4 Address', pattern: /(?<![A-Za-z0-9_.-])(?:\d{1,3}\.){3}\d{1,3}(?![A-Za-z0-9_-]|\.\d)/g, dataClass: DataClass.SENSITIVE, severity: 'low' },
];

const UUID_RE = /(?<![A-Za-z0-9])[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?![A-Za-z0-9])/gi;
const URL_RE = /https?:\/\/[^\s<>'"`)\]]+/gi;
const BLOG_HOST_RE = /(?:^|\.)blogs?\./i;
const BLOG_PATH_RE = /\/[a-z0-9-]*blogs?[a-z0-9-]*(?:\/|$)/i;
const INFO_HOST_RE = /(?:^|\.)(?:news|newsroom|docs|documentation|wiki|help|support|press|medium|substack)\./i;
const INFO_PATH_RE = /\/(?:news|newsroom|announcements?|articles?|posts?|press|press-releases?|docs|documentation|wiki|guides?|help|support|learn|resources?|insights?|research|stories|updates?|changelog|releases?)(?:\/|$)/i;

const UUID_EXCLUDED_PATTERNS = new Set([
  'phone_number',
  'ssn',
  'credit_card',
  'ip_address',
  'openai_key_v2',
  'openai_key',
  'anthropic_key',
  'generic_secret',
]);

const TOKEN_PATTERNS = new Set([
  'aws_access_key',
  'aws_secret_key',
  'github_token',
  'github_fine_grained',
  'anthropic_key',
  'openai_key',
  'openai_key_v2',
  'google_api_key',
  'slack_token',
  'stripe_key',
  'jwt_token',
  'generic_secret',
  'bearer_token',
]);

const PII_PATTERNS = new Set([
  'email_address',
  'phone_number',
  'ssn',
  'credit_card',
  'ip_address',
]);

function passesLuhn(digits) {
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (n < 0 || n > 9) return false;
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum > 0 && sum % 10 === 0;
}

/**
 * Analyze UUID/GUID spans and HTTP(S) URL spans in text so false positives in
 * URLs (especially blog/news/docs URLs) and GUID query/path identifiers are ignored.
 *
 * @param {string} text
 * @returns {{ uuidSpans: Array<{start: number, end: number}>, urlSpans: Array<{start: number, end: number, url: string, pathEnd: number, isBlogUrl: boolean, isInformationalUrl: boolean}> }}
 */
function analyzeTextContext(text) {
  const uuidSpans = [];
  UUID_RE.lastIndex = 0;
  for (const m of text.matchAll(UUID_RE)) {
    const start = m.index ?? 0;
    uuidSpans.push({ start, end: start + m[0].length });
  }

  const urlSpans = [];
  URL_RE.lastIndex = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    const cleanUrl = m[0].replace(/[.,;:!?]+$/, '');
    if (!cleanUrl) continue;
    const end = start + cleanUrl.length;
    const queryIdx = cleanUrl.indexOf('?');
    const hashIdx = cleanUrl.indexOf('#');
    let sepOffset = -1;
    if (queryIdx !== -1 && hashIdx !== -1) {
      sepOffset = Math.min(queryIdx, hashIdx);
    } else {
      sepOffset = Math.max(queryIdx, hashIdx);
    }
    const pathEnd = sepOffset === -1 ? end : start + sepOffset;

    let isBlogUrl = false;
    let isInformationalUrl = false;
    try {
      const parsed = new URL(cleanUrl);
      isBlogUrl = BLOG_HOST_RE.test(parsed.hostname) || BLOG_PATH_RE.test(parsed.pathname);
      isInformationalUrl = isBlogUrl || INFO_HOST_RE.test(parsed.hostname) || INFO_PATH_RE.test(parsed.pathname);
    } catch {
      // Ignore malformed URLs
    }

    urlSpans.push({ start, end, url: cleanUrl, pathEnd, isBlogUrl, isInformationalUrl });
  }

  return { uuidSpans, urlSpans };
}

function spansOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

function isValidPatternMatch(patternName, matchText, start, end, context) {
  if (patternName === 'openai_key_v2') {
    const body = matchText.replace(/^sk-(?:(?:proj|svcacct|admin)-)?/, '');
    if (/^[a-z]+(?:-[a-z]+){2,}$/.test(body)) {
      return false;
    }
    const hasKnownSubPrefix = /^sk-(?:proj|svcacct|admin)-/.test(matchText);
    if (!hasKnownSubPrefix && body.includes('-') && !/[A-Z0-9]/.test(body)) {
      return false;
    }
  } else if (patternName === 'generic_secret') {
    const sepIdx = matchText.search(/[=:]/);
    if (sepIdx !== -1) {
      const rawValue = matchText.slice(sepIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (/^(?:https?:\/\/|\[REDACTED:)/i.test(rawValue)) {
        return false;
      }
    }
  } else if (patternName === 'credit_card') {
    if (!passesLuhn(matchText)) {
      return false;
    }
  } else if (patternName === 'ip_address') {
    const octets = matchText.split('.');
    if (octets.length !== 4 || octets.some((o) => Number(o) > 255)) {
      return false;
    }
  }

  if (UUID_EXCLUDED_PATTERNS.has(patternName)) {
    for (const uuidSpan of context.uuidSpans) {
      if (spansOverlap(start, end, uuidSpan.start, uuidSpan.end)) {
        return false;
      }
    }
  }

  for (const urlSpan of context.urlSpans) {
    if (start >= urlSpan.start && end <= urlSpan.end) {
      const inPath = end <= urlSpan.pathEnd;
      if (patternName === 'phone_number' || patternName === 'ssn' || patternName === 'credit_card') {
        return false;
      }
      if (urlSpan.isBlogUrl) {
        if (
          patternName === 'openai_key_v2' ||
          patternName === 'anthropic_key' ||
          patternName === 'generic_secret' ||
          patternName === 'ip_address'
        ) {
          return false;
        }
        if (inPath && TOKEN_PATTERNS.has(patternName)) {
          return false;
        }
      }
      if (urlSpan.isInformationalUrl && inPath) {
        if (TOKEN_PATTERNS.has(patternName) || PII_PATTERNS.has(patternName)) {
          return false;
        }
      }
      if (inPath && (patternName === 'openai_key_v2' || patternName === 'generic_secret')) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Collect validated, non-overlapping secret and PII matches across text.
 * Shared by both scanForSecrets() and redactSecrets() so detection and redaction stay identical.
 *
 * @param {string} text
 * @returns {Array<{name: string, label: string, dataClass: string, severity: string, start: number, end: number, matchText: string}>}
 */
function collectValidMatches(text) {
  if (!text || typeof text !== 'string') return [];

  const context = analyzeTextContext(text);
  const accepted = [];

  for (const pattern of SECRET_PATTERNS) {
    pattern.pattern.lastIndex = 0;
    for (const m of text.matchAll(pattern.pattern)) {
      const matchText = m[0];
      const start = m.index ?? 0;
      const end = start + matchText.length;

      if (!isValidPatternMatch(pattern.name, matchText, start, end, context)) {
        continue;
      }

      if (accepted.some((a) => spansOverlap(start, end, a.start, a.end))) {
        continue;
      }

      accepted.push({
        name: pattern.name,
        label: pattern.label,
        dataClass: pattern.dataClass,
        severity: pattern.severity,
        start,
        end,
        matchText,
      });
    }
  }

  return accepted;
}

/**
 * Resolve a human-readable label for a privacy rule name.
 * @param {string} name
 * @returns {string}
 */
export function getRuleLabel(name) {
  if (!name || typeof name !== 'string') return 'Unknown Rule';
  const match = SECRET_PATTERNS.find((p) => p.name === name);
  if (match?.label) return match.label;
  if (name === 'excluded_path') return 'Excluded File Path';
  return name
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Extract short surrounding context snippets strictly from already-redacted text.
 * Never touches raw unredacted text so raw secrets can never leak into logs or DB rows.
 *
 * @param {string} redactedText
 * @param {string} ruleName
 * @param {number} [maxSnippets=2]
 * @param {number} [radius=45]
 * @returns {string[]}
 */
export function extractRedactedSnippets(redactedText, ruleName, maxSnippets = 2, radius = 45) {
  if (!redactedText || typeof redactedText !== 'string' || !ruleName) {
    return [];
  }

  const marker = `[REDACTED:${ruleName}]`;
  const snippets = [];
  let searchFrom = 0;

  while (snippets.length < maxSnippets) {
    const idx = redactedText.indexOf(marker, searchFrom);
    if (idx === -1) break;

    const start = Math.max(0, idx - radius);
    const end = Math.min(redactedText.length, idx + marker.length + radius);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < redactedText.length ? '…' : '';
    const rawSlice = redactedText.slice(start, end).replace(/\s+/g, ' ').trim();
    snippets.push(`${prefix}${rawSlice}${suffix}`);

    searchFrom = idx + marker.length;
  }

  return snippets;
}

/**
 * Scan text for secrets and sensitive content.
 * Returns an array of findings, each with type, severity, and matched text.
 *
 * @param {string} text - Text to scan
 * @returns {{ findings: Array<{name: string, label: string, dataClass: string, severity: string, matchCount: number}>, highestClass: string, isSafe: boolean }}
 */
export function scanForSecrets(text) {
  if (!text || typeof text !== 'string') {
    return { findings: [], highestClass: DataClass.SAFE, isSafe: true };
  }

  const matches = collectValidMatches(text);
  const byName = new Map();
  const classHierarchy = [DataClass.SAFE, DataClass.SENSITIVE, DataClass.PERSONAL, DataClass.VENDOR_CONFIDENTIAL, DataClass.SECRET];
  let highestIdx = 0;

  for (const m of matches) {
    let entry = byName.get(m.name);
    if (!entry) {
      entry = {
        name: m.name,
        label: m.label,
        dataClass: m.dataClass,
        severity: m.severity,
        matchCount: 0,
      };
      byName.set(m.name, entry);
      const idx = classHierarchy.indexOf(m.dataClass);
      if (idx > highestIdx) highestIdx = idx;
    }
    entry.matchCount += 1;
  }

  return {
    findings: Array.from(byName.values()),
    highestClass: classHierarchy[highestIdx],
    isSafe: highestIdx === 0,
  };
}

/**
 * Redact detected secrets from text, replacing with [REDACTED:{type}].
 *
 * @param {string} text - Text to redact
 * @returns {{ redacted: string, redactions: Array<{name: string, count: number}> }}
 */
export function redactSecrets(text) {
  if (!text || typeof text !== 'string') {
    return { redacted: text || '', redactions: [] };
  }

  const matches = collectValidMatches(text).sort((a, b) => a.start - b.start);
  if (matches.length === 0) {
    return { redacted: text, redactions: [] };
  }

  const parts = [];
  const countByName = new Map();
  let cursor = 0;

  for (const m of matches) {
    if (m.start > cursor) {
      parts.push(text.slice(cursor, m.start));
    }
    parts.push(`[REDACTED:${m.name}]`);
    cursor = m.end;
    countByName.set(m.name, (countByName.get(m.name) || 0) + 1);
  }
  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  const redactions = Array.from(countByName.entries()).map(([name, count]) => ({ name, count }));
  return { redacted: parts.join(''), redactions };
}

/**
 * Classify a text blob into a data class.
 * Uses deterministic scanning — no model inference.
 *
 * @param {string} text
 * @param {object} [options]
 * @param {string[]} [options.excludedPaths] - Glob patterns for excluded file paths
 * @param {string} [options.filePath] - The file path being classified
 * @returns {{ dataClass: string, findings: Array, shouldStore: boolean }}
 */
export function classifyContent(text, options = {}) {
  // Check file path exclusions
  if (options.filePath && options.excludedPaths) {
    for (const pattern of options.excludedPaths) {
      if (matchGlob(options.filePath, pattern)) {
        return { dataClass: DataClass.EXCLUDED, findings: [], shouldStore: false };
      }
    }
  }

  const { findings, highestClass, isSafe } = scanForSecrets(text);

  // Determine if it's safe to store
  const unstorable = [DataClass.SECRET, DataClass.EXCLUDED];
  const shouldStore = !unstorable.includes(highestClass);

  return { dataClass: highestClass, findings, shouldStore };
}

/**
 * Classify an interaction event for learning.
 * Checks both the prompt metadata and response metadata for safety.
 *
 * @param {object} event
 * @param {string} [event.promptText] - Prompt text (optional, may be hash-only)
 * @param {string} [event.responseText] - Response text (optional, may be hash-only)
 * @param {string[]} [event.filesTouched] - Files touched
 * @param {string[]} [excludedPaths] - Excluded path patterns
 * @returns {{ dataClass: string, findings: Array, shouldStore: boolean, redactedPrompt?: string, redactedResponse?: string }}
 */
export function classifyInteraction(event, excludedPaths = []) {
  const allFindings = [];
  let maxClass = DataClass.SAFE;
  const classHierarchy = [DataClass.SAFE, DataClass.SENSITIVE, DataClass.PERSONAL, DataClass.VENDOR_CONFIDENTIAL, DataClass.SECRET];

  // Check file path exclusions
  if (event.filesTouched) {
    for (const filePath of event.filesTouched) {
      for (const pattern of excludedPaths) {
        if (matchGlob(filePath, pattern)) {
          return {
            dataClass: DataClass.EXCLUDED,
            findings: [{
              name: 'excluded_path',
              label: 'Excluded File Path',
              dataClass: DataClass.EXCLUDED,
              severity: 'high',
              matchCount: 1,
              source: 'file_path',
              snippets: [],
            }],
            shouldStore: false,
          };
        }
      }
    }
  }

  let redactedPrompt;
  let redactedResponse;

  // Scan prompt text if provided
  if (event.promptText) {
    const scan = scanForSecrets(event.promptText);
    const { redacted } = redactSecrets(event.promptText);
    redactedPrompt = redacted;

    for (const finding of scan.findings) {
      allFindings.push({
        ...finding,
        source: 'prompt',
        snippets: extractRedactedSnippets(redactedPrompt, finding.name),
      });
    }
    const idx = classHierarchy.indexOf(scan.highestClass);
    if (idx > classHierarchy.indexOf(maxClass)) maxClass = scan.highestClass;
  }

  // Scan response text if provided
  if (event.responseText) {
    const scan = scanForSecrets(event.responseText);
    const { redacted } = redactSecrets(event.responseText);
    redactedResponse = redacted;

    for (const finding of scan.findings) {
      allFindings.push({
        ...finding,
        source: 'response',
        snippets: extractRedactedSnippets(redactedResponse, finding.name),
      });
    }
    const idx = classHierarchy.indexOf(scan.highestClass);
    if (idx > classHierarchy.indexOf(maxClass)) maxClass = scan.highestClass;
  }

  const unstorable = [DataClass.SECRET, DataClass.EXCLUDED];
  const shouldStore = !unstorable.includes(maxClass);

  return { dataClass: maxClass, findings: allFindings, shouldStore, redactedPrompt, redactedResponse };
}

// ─── Path Exclusion Helpers ─────────────────────────────────────

/**
 * Linear-time glob matching (supports *, **, and ? without catastrophic regex backtracking).
 * @param {string} filePath
 * @param {string} pattern
 * @returns {boolean}
 */
export function matchGlob(filePath, pattern) {
  if (typeof filePath !== 'string' || typeof pattern !== 'string') return false;
  if (pattern.length > 512) return false;

  const text = filePath.replace(/\\/g, '/');
  const normPattern = pattern.replace(/\\/g, '/');

  // Parse pattern into tokens without regex backtracking
  const tokens = [];
  for (let i = 0; i < normPattern.length; i++) {
    const ch = normPattern[i];
    if (ch === '*') {
      if (normPattern[i + 1] === '*') {
        while (normPattern[i + 1] === '*') i++;
        if (tokens[tokens.length - 1]?.type !== '**') {
          tokens.push({ type: '**' });
        }
      } else if (tokens[tokens.length - 1]?.type !== '*' && tokens[tokens.length - 1]?.type !== '**') {
        tokens.push({ type: '*' });
      }
    } else if (ch === '?') {
      tokens.push({ type: '?' });
    } else {
      tokens.push({ type: 'lit', ch });
    }
  }

  let active = new Set([0]);
  const expandEpsilon = (set) => {
    const out = new Set(set);
    const queue = Array.from(set);
    while (queue.length > 0) {
      const idx = queue.pop();
      const tok = tokens[idx];
      if (tok && (tok.type === '*' || tok.type === '**') && !out.has(idx + 1)) {
        out.add(idx + 1);
        queue.push(idx + 1);
      }
    }
    return out;
  };

  active = expandEpsilon(active);

  for (let cIdx = 0; cIdx < text.length; cIdx++) {
    const ch = text[cIdx];
    const next = new Set();
    for (const s of active) {
      const tok = tokens[s];
      if (!tok) continue;
      if (tok.type === '**') {
        next.add(s);
      } else if (tok.type === '*') {
        if (ch !== '/') next.add(s);
      } else if (tok.type === '?') {
        if (ch !== '/') next.add(s + 1);
      } else if (tok.ch === ch) {
        next.add(s + 1);
      }
    }
    active = expandEpsilon(next);
    if (active.size === 0) return false;
  }

  return active.has(tokens.length);
}
