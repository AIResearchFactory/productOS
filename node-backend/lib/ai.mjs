import { isCloudProviderId } from './providers/base.mjs';
import { OllamaProvider } from './providers/ollama.mjs';
import { HostedAPIProvider } from './providers/hosted.mjs';
import { GoogleCliProvider } from './providers/google.mjs';
import { ClaudeCodeProvider } from './providers/claude.mjs';
import { OpenAiCliProvider } from './providers/openai.mjs';
import { CustomCliProvider } from './providers/custom.mjs';
import { RoutedAIProvider } from './model-router.mjs';
import { resolveCliCommand } from './system.mjs';
import path from 'node:path';

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
      'autoRouter',
      'auto_router',
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

  static isCloudProvider(providerType, settings = {}) {
    return isCloudProviderId(providerType, settings);
  }

  static async createProvider(providerType, settings = {}, secrets = {}) {
    const type = String(providerType || settings.activeProvider || settings.active_provider || '');
    const getCfg = (keyCamel, keySnake) => settings[keyCamel] || settings[keySnake] || {};
    const withDetectedCommand = async (config, ...commands) => {
      if (config?.command && path.isAbsolute(config.command)) return config;

      const hasSpecificUserCmd = config?.command && !['gemini', 'geminiCli', 'default'].includes(config.command);
      const targetCommands = hasSpecificUserCmd ? [config.command, ...commands] : commands;
      const detected = await resolveCliCommand(...targetCommands);
      return detected.installed ? { ...config, command: detected.path } : config;
    };

    const mergeConfig = (cfg) => ({ ...cfg });

    const provider = await (async () => {
      const projectPath = settings.projectPath;
      switch (type) {
        case 'autoRouter':
        case 'auto_router':
          return new RoutedAIProvider({
            settings: { ...settings, projectPath },
            secrets,
            projectPath,
            createProvider: (nextProviderType, nextSettings, nextSecrets) => {
              const typeStr = String(nextProviderType || '');
              if (typeStr === 'autoRouter' || typeStr === 'auto_router') {
                throw new Error('Self-referential autoRouter provider loop detected');
              }
              return AIService.createProvider(nextProviderType, nextSettings, nextSecrets);
            },
          });
        case 'ollama':
          return new OllamaProvider(mergeConfig(getCfg('ollama', 'ollama')), secrets, projectPath);
        case 'hostedApi':
        case 'hosted':
          return new HostedAPIProvider(mergeConfig(getCfg('hosted', 'hosted')), secrets, projectPath);
        case 'googleAntigravity':
        case 'google_antigravity':
        case 'antigravity':
        case 'googleCli':
        case 'google_cli':
        case 'google':
        case 'geminiCli':
        case 'gemini_cli': {
          const cfg = mergeConfig(getCfg('geminiCli', 'gemini_cli'));
          const commandsToTry = (cfg.command && path.isAbsolute(cfg.command))
            ? [cfg.command]
            : (cfg.command && !['gemini', 'geminiCli', 'default'].includes(cfg.command))
              ? [cfg.command, 'agy', 'gemini']
              : ['agy', 'gemini'];
          return new GoogleCliProvider(await withDetectedCommand(cfg, ...commandsToTry), secrets, projectPath);
        }
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
