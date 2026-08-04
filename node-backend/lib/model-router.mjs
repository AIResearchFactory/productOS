const CLOUD_PROVIDER_IDS = new Set([
  'hostedApi',
  'hosted',
  'geminiCli',
  'gemini_cli',
  'googleCli',
  'google_cli',
  'google',
  'googleAntigravity',
  'google_antigravity',
  'antigravity',
  'claudeCode',
  'claude_code',
  'claude',
  'openAiCli',
  'openai_cli',
  'openai',
  'liteLlm',
  'customCli',
  'custom_cli',
  'custom',
]);

const LOCAL_PROVIDER_IDS = new Set(['ollama']);

const DEFAULT_LOCAL_TIMEOUT_MS = 3000;
const DEFAULT_BACKGROUND_TIMEOUT_MS = 15000;

function normalizeMode(mode) {
  switch (mode) {
    case 'local-only':
    case 'localOnly':
      return 'localOnly';
    case 'cloud-only':
    case 'cloudOnly':
      return 'cloudOnly';
    case 'privacy-first':
    case 'privacyFirst':
      return 'privacyFirst';
    case 'performance-first':
    case 'performanceFirst':
      return 'performanceFirst';
    default:
      return 'auto';
  }
}

function normalizeFallback(fallback) {
  switch (fallback) {
    case 'cloud-redacted':
    case 'cloudRedacted':
      return 'cloudRedacted';
    case 'ask-user':
    case 'askUser':
      return 'askUser';
    case 'local':
    case 'cloud':
    case 'none':
      return fallback;
    default:
      return 'cloudRedacted';
  }
}

function sanitizeProviderId(id, fallback) {
  const type = String(id || '');
  return (type === 'autoRouter' || type === 'auto_router') ? fallback : (id || fallback);
}

function routerSettings(settings = {}) {
  const config = settings.modelRouter || settings.model_router || settings.autoRouter || settings.auto_router || {};
  return {
    enabled: config.enabled !== false,
    mode: normalizeMode(config.mode || settings.modelRoutingMode),
    localProvider: sanitizeProviderId(config.localProvider || config.local_provider, 'ollama'),
    cloudProvider: sanitizeProviderId(config.cloudProvider || config.cloud_provider || settings.fallbackProvider, 'hostedApi'),
    fallback: normalizeFallback(config.fallback || config.fallbackMode || config.fallback_mode),
    localTimeoutMs: Number(config.localTimeoutMs || config.local_timeout_ms || DEFAULT_LOCAL_TIMEOUT_MS),
    backgroundTimeoutMs: Number(config.backgroundTimeoutMs || config.background_timeout_ms || DEFAULT_BACKGROUND_TIMEOUT_MS),
    defaultPrivacyLevel: config.defaultPrivacyLevel || config.default_privacy_level || 'workspace-private',
    logDecisions: config.logDecisions !== false && config.log_decisions !== false,
  };
}

function isCloudProvider(providerId, settings = {}) {
  const id = String(providerId || '');
  if (id === 'ollama') return false;
  if (id.startsWith('custom-local-')) return false;
  if (CLOUD_PROVIDER_IDS.has(id)) return true;
  const customClis = settings.customClis || settings.custom_clis || [];
  if (Array.isArray(customClis)) {
    const custom = customClis.find(c => c.id === id || `custom-${c.id}` === id || c.name === id || `custom-${c.name}` === id);
    if (custom) {
      if (typeof custom.isCloud === 'boolean') return custom.isCloud;
      if (custom.id?.startsWith('custom-local-') || custom.id?.includes('local')) return false;
    }
  }
  if (id.startsWith('custom-') || id.startsWith('custom_') || id.includes('custom')) return true;
  return !LOCAL_PROVIDER_IDS.has(id);
}

function isLocalProvider(providerId, settings = {}) {
  return !isCloudProvider(providerId, settings);
}

function isSensitiveText(text = '') {
  return /(api[_-]?key|secret|token|password|private key|BEGIN [A-Z ]*PRIVATE KEY|\.env\b|ssh-(rsa|ed25519|dss|ecdsa[a-z0-9-]*)|ghp_[a-z0-9_]+)/i.test(text);
}

function inferRequestTraits(request = {}, settings = {}) {
  const messages = Array.isArray(request.messages) ? request.messages : [];
  const text = [request.system_prompt || '', ...messages.map((m) => m?.content || '')].join('\n');
  const task = request.task || request.options?.task || 'chat';
  const priority = request.priority || request.options?.priority || 'quality';
  const privacyLevel = request.privacyLevel || request.privacy_level || request.options?.privacyLevel || routerSettings(settings).defaultPrivacyLevel;
  const touchesWorkspace = Boolean(settings.projectPath || /project context|workspace|repository|repo-private|file tree/i.test(text));
  const containsSecrets = isSensitiveText(text);
  const isBackground = request.options?.background === true || request.background === true || task === 'workflow' || task === 'enrichment';
  return { task, priority, privacyLevel, touchesWorkspace, containsSecrets, isBackground };
}

function hasPrivateData(traits) {
  return traits.containsSecrets || ['secret', 'user-secret', 'repo-private', 'workspace-private', 'private'].includes(String(traits.privacyLevel || '')) || traits.touchesWorkspace;
}

export function redactModelRequestForCloud(request = {}) {
  const redactText = (value = '') => String(value)
    .replace(/(api[_-]?key|token|secret|password)(\s*[:=]\s*)[^\s\n]+/gi, '$1$2[REDACTED]')
    .replace(/ghp_[A-Za-z0-9_]+/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]')
    .replace(/\bprivate key\b/gi, '[REDACTED_PRIVATE_KEY]')
    .replace(/ssh-(rsa|ed25519|dss|ecdsa[a-z0-9-]*)\s+[A-Za-z0-9+/=]+(\s+\S+)?/gi, '[REDACTED_SSH_KEY]')
    .replace(/([A-Za-z]:)?[\\/][^\n\r]*(\.env|id_rsa|id_ed25519)[^\n\r]*/gi, '[REDACTED_SECRET_PATH]');

  return {
    ...request,
    system_prompt: request.system_prompt ? redactText(request.system_prompt) : request.system_prompt,
    messages: Array.isArray(request.messages)
      ? request.messages.map((message) => ({ ...message, content: redactText(message.content || '') }))
      : request.messages,
  };
}

export function resolveModelRoute({ request = {}, settings = {}, requestedProvider } = {}) {
  const config = routerSettings(settings);
  const traits = inferRequestTraits(request, settings);
  const privateData = hasPrivateData(traits);

  if (config.enabled === false) {
    return {
      primary: config.cloudProvider,
      fallback: null,
      fallbackRequest: 'none',
      reason: 'router-disabled',
      traits,
      timeoutMs: null,
    };
  }

  if (requestedProvider && requestedProvider !== 'autoRouter') {
    return {
      primary: requestedProvider,
      fallback: null,
      fallbackRequest: 'none',
      reason: 'explicit-provider',
      traits,
      timeoutMs: null,
    };
  }

  if (config.mode === 'localOnly') {
    return { primary: config.localProvider, fallback: null, fallbackRequest: 'none', reason: 'local-only-mode', traits, timeoutMs: null };
  }

  if (config.mode === 'cloudOnly') {
    return { primary: config.cloudProvider, fallback: null, fallbackRequest: 'none', reason: 'cloud-only-mode', traits, timeoutMs: null };
  }

  if (config.mode === 'performanceFirst' && !privateData) {
    return {
      primary: config.cloudProvider,
      fallback: config.localProvider,
      fallbackRequest: 'original',
      reason: 'performance-first-public-data',
      traits,
      timeoutMs: traits.isBackground ? config.backgroundTimeoutMs : config.localTimeoutMs,
    };
  }

  if (privateData || config.mode === 'privacyFirst') {
    const fallback = config.fallback === 'cloud' || config.fallback === 'cloudRedacted' ? config.cloudProvider : null;
    return {
      primary: config.localProvider,
      fallback,
      fallbackRequest: fallback ? config.fallback : 'none',
      reason: privateData ? 'private-workspace-data' : 'privacy-first-mode',
      traits,
      timeoutMs: traits.isBackground ? config.backgroundTimeoutMs : config.localTimeoutMs,
    };
  }

  return {
    primary: config.localProvider,
    fallback: config.cloudProvider,
    fallbackRequest: 'original',
    reason: 'auto-prefer-local',
    traits,
    timeoutMs: traits.isBackground ? config.backgroundTimeoutMs : config.localTimeoutMs,
  };
}

function withTimeout(promise, timeoutMs, label, onTimeout) {
  if (!timeoutMs || timeoutMs <= 0) return promise;
  let timeout;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeout = setTimeout(() => {
        try { onTimeout?.(); } catch { /* best-effort abort */ }
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]).finally(() => clearTimeout(timeout));
}

function requestWithTimeoutSignal(request, timeoutMs) {
  if (!timeoutMs || timeoutMs <= 0) return { request, abort: null };

  const controller = new AbortController();
  const parentSignal = request.signal;
  const abort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort();
    else parentSignal.addEventListener('abort', abort, { once: true });
  }

  const cleanup = () => parentSignal?.removeEventListener?.('abort', abort);
  return {
    request: { ...request, signal: controller.signal },
    abort: () => {
      cleanup();
      controller.abort();
    },
    cleanup,
  };
}

export class RoutedAIProvider {
  constructor({ settings = {}, secrets = {}, projectPath, createProvider }) {
    this.settings = settings;
    this.secrets = secrets;
    this.projectPath = projectPath;
    this.createProvider = createProvider;
    this.lastDecision = null;
    this.config = routerSettings(settings);
  }

  providerType() {
    return 'autoRouter';
  }

  async displayName() {
    return 'Model Router';
  }

  async resolveModel() {
    return this.lastDecision?.model || this.lastDecision?.provider || 'autoRouter';
  }

  async checkAuthentication() {
    const config = this.config || routerSettings(this.settings);
    const candidates = config.mode === 'localOnly'
      ? [config.localProvider]
      : config.mode === 'cloudOnly'
        ? [config.cloudProvider]
        : [...new Set([config.localProvider, config.cloudProvider].filter(Boolean))];

    for (const providerId of candidates) {
      try {
        const provider = await this.createProvider(providerId, this.settings, this.secrets);
        if (await provider.checkAuthentication().catch(() => false)) return true;
      } catch {
        // Try the next configured provider.
      }
    }
    return false;
  }

  async listModels() {
    const config = this.config || routerSettings(this.settings);
    const provider = await this.createProvider(config.localProvider, this.settings, this.secrets);
    return provider.listModels();
  }

  async chat(request) {
    const decision = resolveModelRoute({ request, settings: this.settings, requestedProvider: 'autoRouter' });
    if (this.config?.logDecisions) {
      console.log(`[ModelRouter] Executing route decision: primary=${decision.primary}, fallback=${decision.fallback || 'none'}, reason=${decision.reason}`);
    }
    return this.#chatWithDecision(request, decision);
  }

  async #chatWithDecision(request, decision) {
    const startedAt = Date.now();
    const primary = await this.createProvider(decision.primary, this.settings, this.secrets);
    const primaryLabel = primary.displayName ? await primary.displayName() : decision.primary;

    try {
      const timedPrimary = requestWithTimeoutSignal(request, decision.timeoutMs);
      const response = await withTimeout(
        primary.chat(timedPrimary.request),
        decision.timeoutMs,
        primaryLabel,
        timedPrimary.abort,
      ).finally(() => timedPrimary.cleanup?.());
      this.lastDecision = await this.#decisionMetadata(decision, primary, false, Date.now() - startedAt);
      response.metadata = {
        ...(response.metadata || {}),
        routing: this.lastDecision,
      };
      return response;
    } catch (error) {
      if (!decision.fallback) throw error;
      if (decision.fallbackRequest === 'askUser') {
        throw new Error(`${primaryLabel} failed (${error.message}). Cloud fallback requires user approval for this request.`);
      }

      const fallbackRequest = decision.fallbackRequest === 'cloudRedacted'
        ? redactModelRequestForCloud(request)
        : request;
      const fallback = await this.createProvider(decision.fallback, this.settings, this.secrets);
      const response = await fallback.chat(fallbackRequest);
      this.lastDecision = await this.#decisionMetadata(decision, fallback, true, Date.now() - startedAt, error);
      response.metadata = {
        ...(response.metadata || {}),
        routing: this.lastDecision,
      };
      return response;
    }
  }

  async #decisionMetadata(decision, provider, fallbackUsed, latencyMs, error = null) {
    const isCloud = provider.isCloudProvider ? provider.isCloudProvider() : isCloudProvider(provider.providerType(), this.settings);
    return {
      router: 'autoRouter',
      provider: provider.providerType(),
      model: await provider.resolveModel().catch(() => provider.providerType()),
      primaryProvider: decision.primary,
      fallbackProvider: decision.fallback,
      fallbackUsed,
      fallbackRequest: fallbackUsed ? decision.fallbackRequest : 'none',
      reason: decision.reason,
      latencyMs,
      error: error ? error.message : undefined,
      privacyLevel: decision.traits?.privacyLevel,
      containsSecrets: Boolean(decision.traits?.containsSecrets),
      local: !isCloud,
      cloud: isCloud,
    };
  }
}
