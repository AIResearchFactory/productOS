export const BUILTIN_PROVIDER_LABELS = {
  hostedApi: 'Hosted API',
  hosted: 'Hosted API',
  claudeCode: 'Claude Code CLI',
  claude_code: 'Claude Code CLI',
  claude: 'Claude Code CLI',
  geminiCli: 'Google Gemini CLI',
  gemini_cli: 'Google Gemini CLI',
  googleCli: 'Google Gemini CLI',
  google_cli: 'Google Gemini CLI',
  google: 'Google Gemini CLI',
  googleAntigravity: 'Google Antigravity',
  google_antigravity: 'Google Antigravity',
  antigravity: 'Google Antigravity',
  openAiCli: 'OpenAI / Codex CLI',
  openai_cli: 'OpenAI / Codex CLI',
  openai: 'OpenAI / Codex CLI',
  ollama: 'Ollama',
  liteLlm: 'LiteLLM',
  litellm: 'LiteLLM',
  autoRouter: 'Model Router',
  auto_router: 'Model Router',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve a human-readable display name for a provider ID, checking built-in names,
 * configured custom CLIs, and optional persisted record metadata.
 *
 * @param {string | null | undefined} providerId
 * @param {{ customClis?: Array<{ id?: string, name?: string }>, custom_clis?: Array<{ id?: string, name?: string }> }} [settings]
 * @param {{ provider_name?: string, providerName?: string } | null} [record]
 * @returns {string}
 */
export function resolveProviderDisplayName(providerId, settings = {}, record = null) {
  const type = String(providerId || '').trim();
  if (type && BUILTIN_PROVIDER_LABELS[type]) {
    return BUILTIN_PROVIDER_LABELS[type];
  }

  const cleanId = type.replace(/^custom-/, '');
  const customClis = settings?.customClis || settings?.custom_clis || [];
  if (Array.isArray(customClis) && type) {
    const custom = customClis.find(
      (c) =>
        c?.id === type ||
        c?.id === cleanId ||
        `custom-${c?.id}` === type ||
        c?.name === type ||
        `custom-${c?.name}` === type
    );
    if (custom && typeof custom.name === 'string' && custom.name.trim()) {
      return custom.name.trim();
    }
  }

  const recordLabel = record?.provider_name ?? record?.providerName;
  if (typeof recordLabel === 'string' && recordLabel.trim()) {
    return recordLabel.trim();
  }

  if (UUID_RE.test(cleanId)) {
    return `Custom CLI (${cleanId.slice(0, 8)})`;
  }

  return type || 'unknown';
}
