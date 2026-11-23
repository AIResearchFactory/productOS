export type VisionSupportStatus = 'supported' | 'unsupported' | 'unverified';

export interface VisionCapabilityResult {
  status: VisionSupportStatus;
  reason?: string;
  modelName?: string;
}

export interface VisionCustomCliLike {
  id: string;
  name?: string;
  model?: string;
  isCloud?: boolean;
  supportsImages?: boolean;
}

export interface VisionSettingsLike {
  activeProvider?: string;
  ollama?: { model?: string };
  hosted?: { model?: string; provider?: string };
  geminiCli?: { modelAlias?: string };
  openAiCli?: { modelAlias?: string };
  claude?: { model?: string };
  customClis?: VisionCustomCliLike[];
  modelRouter?: {
    enabled?: boolean;
    mode?: string;
    localProvider?: string;
    cloudProvider?: string;
  };
}

const KNOWN_OLLAMA_VISION_PATTERNS = [
  /llava/i,
  /bakllava/i,
  /moondream/i,
  /minicpm-?v/i,
  /llama3\.2-?vision/i,
  /llama-?3\.2-?vision/i,
  /qwen2\.?5?-?vl/i,
  /qwen-?vl/i,
  /gemma3/i,
  /pixtral/i,
  /mistral-small3\.1/i,
  /granite3\.2-vision/i,
  /\bvision\b/i,
  /-vl\b/i,
];

const KNOWN_TEXT_ONLY_HOSTED_PATTERNS = [
  /^gpt-3\.5/i,
  /^text-davinci/i,
  /^o1-mini/i,
  /^deepseek-r1/i,
  /^deepseek-chat/i,
];

function findCustomCli(provider: string, customClis: VisionCustomCliLike[] = []): VisionCustomCliLike | undefined {
  const clean = provider.startsWith('custom-custom-')
    ? provider.replace('custom-custom-', '')
    : provider.replace(/^custom-/, '');
  return customClis.find(
    (cli) =>
      cli.id === provider ||
      `custom-${cli.id}` === provider ||
      cli.id === clean ||
      cli.name === provider ||
      `custom-${cli.name}` === provider
  );
}

/**
 * Determine whether the selected provider/model supports image attachments.
 * Pure helper with zero framework imports so both React UI and node --test can execute it.
 */
export function resolveVisionCapability({
  provider,
  model,
  settings,
  ollamaApiSupport,
}: {
  provider: string;
  model?: string;
  settings?: VisionSettingsLike | null;
  ollamaApiSupport?: boolean | null;
}): VisionCapabilityResult {
  const active = String(provider || settings?.activeProvider || 'hostedApi');
  const customClis = Array.isArray(settings?.customClis) ? settings.customClis : [];

  const matchedCustom = active.startsWith('custom-')
    ? findCustomCli(active, customClis)
    : findCustomCli(active, customClis);

  if (active.startsWith('custom-') || matchedCustom) {
    if (matchedCustom?.supportsImages === true) {
      return {
        status: 'supported',
        modelName: matchedCustom.model || matchedCustom.name || active,
      };
    }
    return {
      status: 'unverified',
      modelName: matchedCustom?.name || active,
      reason:
        'Image support for this custom CLI is unverified. Confirm "Supports Images (CLI)" in Settings -> AI & Models if supported.',
    };
  }

  if (active === 'autoRouter' || active === 'auto_router') {
    const mode = settings?.modelRouter?.mode || 'auto';
    const target =
      mode === 'cloudOnly' || mode === 'performanceFirst'
        ? settings?.modelRouter?.cloudProvider || 'hostedApi'
        : settings?.modelRouter?.localProvider || 'ollama';
    if (target && target !== 'autoRouter' && target !== 'auto_router') {
      return resolveVisionCapability({
        provider: target,
        model,
        settings,
        ollamaApiSupport,
      });
    }
    return { status: 'supported', modelName: 'Model Router' };
  }

  if (active === 'ollama') {
    const modelName = (model || settings?.ollama?.model || '').trim();
    if (ollamaApiSupport === true) {
      return { status: 'supported', modelName: modelName || 'ollama' };
    }
    if (ollamaApiSupport === false) {
      return {
        status: 'unsupported',
        modelName: modelName || 'ollama',
        reason: `Selected model (${modelName || 'Ollama'}) does not support image analysis. Switch to a vision-capable model or remove the image to send.`,
      };
    }
    if (!modelName) {
      return {
        status: 'unsupported',
        modelName: 'ollama',
        reason: 'No Ollama vision model selected. Select a vision-capable model (e.g. llama3.2-vision, llava) or remove the image to send.',
      };
    }
    const isVisionModel = KNOWN_OLLAMA_VISION_PATTERNS.some((re) => re.test(modelName));
    if (isVisionModel) {
      return { status: 'supported', modelName };
    }
    return {
      status: 'unsupported',
      modelName,
      reason: `Selected model (${modelName}) does not support image analysis. Switch to a vision-capable model or remove the image to send.`,
    };
  }

  if (active === 'geminiCli' || active === 'gemini_cli' || active === 'googleCli' || active === 'google') {
    const modelName = (model || settings?.geminiCli?.modelAlias || '').trim();
    if (/gpt-oss/i.test(modelName)) {
      return {
        status: 'unsupported',
        modelName,
        reason: `Selected model (${modelName}) does not support image analysis. Switch to a Gemini/Claude vision model or remove the image to send.`,
      };
    }
    return { status: 'supported', modelName: modelName || 'Google CLI' };
  }

  if (active === 'hostedApi' || active === 'hosted') {
    const modelName = (model || settings?.hosted?.model || '').trim();
    if (modelName && KNOWN_TEXT_ONLY_HOSTED_PATTERNS.some((re) => re.test(modelName))) {
      return {
        status: 'unsupported',
        modelName,
        reason: `Selected model (${modelName}) does not support image analysis. Switch to a vision-capable model or remove the image to send.`,
      };
    }
    return { status: 'supported', modelName: modelName || 'Hosted API' };
  }

  if (active === 'claudeCode' || active === 'claude_code' || active === 'claude') {
    return { status: 'supported', modelName: model || settings?.claude?.model || 'Claude CLI' };
  }

  if (active === 'openAiCli' || active === 'openai_cli' || active === 'openai') {
    return { status: 'supported', modelName: model || settings?.openAiCli?.modelAlias || 'OpenAI CLI' };
  }

  return { status: 'supported', modelName: model || active };
}
