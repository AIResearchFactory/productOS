import { OllamaProvider } from './providers/ollama.mjs';
import { HostedAPIProvider } from './providers/hosted.mjs';
import { GeminiCliProvider } from './providers/gemini.mjs';
import { ClaudeCodeProvider } from './providers/claude.mjs';
import { OpenAiCliProvider } from './providers/openai.mjs';
import { CustomCliProvider } from './providers/custom.mjs';
import { resolveCliCommand } from './system.mjs';

export class AIService {
  static authCache = new Map();
  static AUTH_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  static isSupportedProvider(providerType, settings = {}) {
    const type = String(providerType || '');
    const builtInProviders = new Set([
      'ollama',
      'hostedApi',
      'hosted',
      'geminiCli',
      'gemini_cli',
      'claudeCode',
      'claude_code',
      'claude',
      'openAiCli',
      'openai_cli',
      'openai',
    ]);
    if (builtInProviders.has(type)) return true;

    const customClis = settings.customClis || settings.custom_clis || [];
    return Array.isArray(customClis) && customClis.some(c =>
      c.id === type ||
      `custom-${c.id}` === type ||
      c.name === type ||
      `custom-${c.name}` === type
    );
  }

  static async createProvider(providerType, settings = {}, secrets = {}) {
    const type = String(providerType || settings.activeProvider || settings.active_provider || '');
    const getCfg = (keyCamel, keySnake) => settings[keyCamel] || settings[keySnake] || {};
    const withDetectedCommand = async (config, ...commands) => {
      if (config?.command) return config;

      const detected = await resolveCliCommand(...commands);
      return detected.installed ? { ...config, command: detected.path } : config;
    };

    const mergeConfig = (cfg) => ({ ...cfg });

    const provider = await (async () => {
      const projectPath = settings.projectPath;
      switch (type) {
        case 'ollama':
          return new OllamaProvider(mergeConfig(getCfg('ollama', 'ollama')), secrets, projectPath);
        case 'hostedApi':
        case 'hosted':
          return new HostedAPIProvider(mergeConfig(getCfg('hosted', 'hosted')), secrets, projectPath);
        case 'geminiCli':
        case 'gemini_cli':
          return new GeminiCliProvider(await withDetectedCommand(mergeConfig(getCfg('geminiCli', 'gemini_cli')), 'gemini'), secrets, projectPath);
        case 'claudeCode':
        case 'claude_code':
        case 'claude':
          return new ClaudeCodeProvider(await withDetectedCommand(mergeConfig(getCfg('claude', 'claude_code')), 'claude'), secrets, projectPath);
        case 'openAiCli':
        case 'openai_cli':
        case 'openai':
          return new OpenAiCliProvider(await withDetectedCommand(mergeConfig(getCfg('openAiCli', 'openai_cli')), 'codex', 'openai'), secrets, projectPath);
        default: {
          const customClis = settings.customClis || settings.custom_clis || [];
          if (Array.isArray(customClis)) {
            const custom = customClis.find(c => 
              c.id === type || 
              `custom-${c.id}` === type ||
              c.name === type ||
              `custom-${c.name}` === type
            );
            if (custom) return new CustomCliProvider(mergeConfig(custom), secrets, projectPath);
          }
          return new HostedAPIProvider(mergeConfig(getCfg('hosted', 'hosted')), secrets, projectPath);
        }
      }
    })();

    // Wrap checkAuthentication with caching
    const originalCheckAuth = provider.checkAuthentication.bind(provider);
    provider.checkAuthentication = async () => {
      const cacheKey = `${provider.providerType()}-${JSON.stringify(provider.config)}`;
      const cached = AIService.authCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < AIService.AUTH_CACHE_TTL)) {
        return cached.result;
      }
      
      const result = await originalCheckAuth();
      if (result) {
        AIService.authCache.set(cacheKey, { result, timestamp: Date.now() });
      }
      return result;
    };

    return provider;
  }
}
