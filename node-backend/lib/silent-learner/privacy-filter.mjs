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
 * Each entry: { name, pattern, dataClass, severity }
 */
const SECRET_PATTERNS = [
  // API Keys & Tokens
  { name: 'aws_access_key', label: 'AWS Access Key', pattern: /(?:AKIA|ASIA)[A-Z0-9]{16}/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'aws_secret_key', label: 'AWS Secret Access Key', pattern: /(?:aws_secret_access_key|secret_key)\s*[=:]\s*["']?[A-Za-z0-9/+=]{40}["']?/gi, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'github_token', label: 'GitHub Token', pattern: /gh[pousr]_[A-Za-z0-9_]{36,255}/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'github_fine_grained', label: 'GitHub Fine-Grained Token', pattern: /github_pat_[A-Za-z0-9_]{22,255}/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'openai_key', label: 'OpenAI Legacy API Key', pattern: /sk-[A-Za-z0-9]{20,}T3BlbkFJ[A-Za-z0-9]{20,}/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'openai_key_v2', label: 'OpenAI API Key', pattern: /sk-(?:proj-)?[A-Za-z0-9_-]{32,}/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'anthropic_key', label: 'Anthropic API Key', pattern: /sk-ant-[A-Za-z0-9_-]{32,}/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'google_api_key', label: 'Google API Key', pattern: /AIza[A-Za-z0-9_\\-]{35}/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'slack_token', label: 'Slack Token', pattern: /xox[bposaer]-[0-9]{10,13}-[A-Za-z0-9-]{24,}/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'stripe_key', label: 'Stripe API Key', pattern: /(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{24,}/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'jwt_token', label: 'JSON Web Token (JWT)', pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, dataClass: DataClass.SECRET, severity: 'high' },
  { name: 'generic_secret', label: 'Generic Secret / API Key Assignment', pattern: /(?:api[_-]?key|api[_-]?secret|access[_-]?token|auth[_-]?token|secret[_-]?key|private[_-]?key)\s*[=:]\s*["']?[A-Za-z0-9_\-.+=\/]{16,}["']?/gi, dataClass: DataClass.SECRET, severity: 'high' },
  { name: 'bearer_token', label: 'Bearer Auth Token', pattern: /Bearer\s+[A-Za-z0-9_\-.+=\/]{20,}/g, dataClass: DataClass.SECRET, severity: 'high' },
  { name: 'private_key_block', label: 'Private Key Block', pattern: /-----BEGIN\s+(?:[A-Z0-9 ]+\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:[A-Z0-9 ]+\s+)?PRIVATE\s+KEY-----/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'private_key_header', label: 'Private Key Header', pattern: /-----BEGIN\s+(?:[A-Z0-9 ]+\s+)?PRIVATE\s+KEY-----/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'connection_string', label: 'Database / Service Connection String', pattern: /(?:postgres|mysql|mongodb|redis):\/\/[^\s'"]+:[^\s'"]+@[^\s'"]+/gi, dataClass: DataClass.SECRET, severity: 'critical' },

  // PII patterns
  { name: 'email_address', label: 'Email Address', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, dataClass: DataClass.PERSONAL, severity: 'medium' },
  { name: 'phone_number', label: 'Phone Number', pattern: /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g, dataClass: DataClass.PERSONAL, severity: 'medium' },
  { name: 'ssn', label: 'Social Security Number (SSN)', pattern: /\b\d{3}-\d{2}-\d{4}\b/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'credit_card', label: 'Credit Card Number', pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'ip_address', label: 'IPv4 Address', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, dataClass: DataClass.SENSITIVE, severity: 'low' },
];

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

  const findings = [];
  const classHierarchy = [DataClass.SAFE, DataClass.SENSITIVE, DataClass.PERSONAL, DataClass.VENDOR_CONFIDENTIAL, DataClass.SECRET];
  let highestIdx = 0;

  for (const pattern of SECRET_PATTERNS) {
    // Reset lastIndex for global regex
    pattern.pattern.lastIndex = 0;
    const matches = text.match(pattern.pattern);
    if (matches && matches.length > 0) {
      findings.push({
        name: pattern.name,
        label: pattern.label,
        dataClass: pattern.dataClass,
        severity: pattern.severity,
        matchCount: matches.length,
      });
      const idx = classHierarchy.indexOf(pattern.dataClass);
      if (idx > highestIdx) highestIdx = idx;
    }
  }

  return {
    findings,
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

  let result = text;
  const redactions = [];

  for (const pattern of SECRET_PATTERNS) {
    pattern.pattern.lastIndex = 0;
    const matches = result.match(pattern.pattern);
    if (matches && matches.length > 0) {
      result = result.replace(pattern.pattern, `[REDACTED:${pattern.name}]`);
      redactions.push({ name: pattern.name, count: matches.length });
    }
  }

  return { redacted: result, redactions };
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
