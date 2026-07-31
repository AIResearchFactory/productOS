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
  { name: 'aws_access_key', pattern: /(?:AKIA|ASIA)[A-Z0-9]{16}/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'aws_secret_key', pattern: /(?:aws_secret_access_key|secret_key)\s*[=:]\s*["']?[A-Za-z0-9/+=]{40}["']?/gi, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'github_token', pattern: /gh[pousr]_[A-Za-z0-9_]{36,255}/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'github_fine_grained', pattern: /github_pat_[A-Za-z0-9_]{22,255}/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'openai_key', pattern: /sk-[A-Za-z0-9]{20,}T3BlbkFJ[A-Za-z0-9]{20,}/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'openai_key_v2', pattern: /sk-(?:proj-)?[A-Za-z0-9_-]{32,}/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'anthropic_key', pattern: /sk-ant-[A-Za-z0-9_-]{32,}/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'google_api_key', pattern: /AIza[A-Za-z0-9_\\-]{35}/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'slack_token', pattern: /xox[bposaer]-[0-9]{10,13}-[A-Za-z0-9-]{24,}/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'stripe_key', pattern: /(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{24,}/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'jwt_token', pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, dataClass: DataClass.SECRET, severity: 'high' },
  { name: 'generic_secret', pattern: /(?:api[_-]?key|api[_-]?secret|access[_-]?token|auth[_-]?token|secret[_-]?key|private[_-]?key)\s*[=:]\s*["']?[A-Za-z0-9_\-.+=\/]{16,}["']?/gi, dataClass: DataClass.SECRET, severity: 'high' },
  { name: 'bearer_token', pattern: /Bearer\s+[A-Za-z0-9_\-.+=\/]{20,}/g, dataClass: DataClass.SECRET, severity: 'high' },
  { name: 'private_key_block', pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'connection_string', pattern: /(?:postgres|mysql|mongodb|redis):\/\/[^\s'"]+:[^\s'"]+@[^\s'"]+/gi, dataClass: DataClass.SECRET, severity: 'critical' },

  // PII patterns
  { name: 'email_address', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, dataClass: DataClass.PERSONAL, severity: 'medium' },
  { name: 'phone_number', pattern: /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g, dataClass: DataClass.PERSONAL, severity: 'medium' },
  { name: 'ssn', pattern: /\b\d{3}-\d{2}-\d{4}\b/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'credit_card', pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g, dataClass: DataClass.SECRET, severity: 'critical' },
  { name: 'ip_address', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, dataClass: DataClass.SENSITIVE, severity: 'low' },
];

/**
 * Scan text for secrets and sensitive content.
 * Returns an array of findings, each with type, severity, and matched text.
 *
 * @param {string} text - Text to scan
 * @returns {{ findings: Array<{name: string, dataClass: string, severity: string, matchCount: number}>, highestClass: string, isSafe: boolean }}
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
          return { dataClass: DataClass.EXCLUDED, findings: [{ name: 'excluded_path', dataClass: DataClass.EXCLUDED, severity: 'high', matchCount: 1 }], shouldStore: false };
        }
      }
    }
  }

  let redactedPrompt;
  let redactedResponse;

  // Scan prompt text if provided
  if (event.promptText) {
    const scan = scanForSecrets(event.promptText);
    allFindings.push(...scan.findings);
    const idx = classHierarchy.indexOf(scan.highestClass);
    if (idx > classHierarchy.indexOf(maxClass)) maxClass = scan.highestClass;

    const { redacted } = redactSecrets(event.promptText);
    redactedPrompt = redacted;
  }

  // Scan response text if provided
  if (event.responseText) {
    const scan = scanForSecrets(event.responseText);
    allFindings.push(...scan.findings);
    const idx = classHierarchy.indexOf(scan.highestClass);
    if (idx > classHierarchy.indexOf(maxClass)) maxClass = scan.highestClass;

    const { redacted } = redactSecrets(event.responseText);
    redactedResponse = redacted;
  }

  const unstorable = [DataClass.SECRET, DataClass.EXCLUDED];
  const shouldStore = !unstorable.includes(maxClass);

  return { dataClass: maxClass, findings: allFindings, shouldStore, redactedPrompt, redactedResponse };
}

// ─── Path Exclusion Helpers ─────────────────────────────────────

/**
 * Simple glob matching (supports * and **).
 * @param {string} filePath
 * @param {string} pattern
 * @returns {boolean}
 */
function matchGlob(filePath, pattern) {
  // Convert glob to regex
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/{{GLOBSTAR}}/g, '.*');
  const regex = new RegExp(`^${escaped}$`);
  return regex.test(filePath);
}
