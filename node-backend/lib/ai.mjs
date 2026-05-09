import { OllamaProvider } from './providers/ollama.mjs';
import { HostedAPIProvider } from './providers/hosted.mjs';
import { GeminiCliProvider } from './providers/gemini.mjs';
import { ClaudeCodeProvider } from './providers/claude.mjs';
import { OpenAiCliProvider } from './providers/openai.mjs';
import { CustomCliProvider } from './providers/custom.mjs';
import { resolveCliCommand } from './system.mjs';

export class AIService {
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

    switch (type) {
      case 'ollama':
        return new OllamaProvider(getCfg('ollama', 'ollama'), secrets);
      case 'hostedApi':
      case 'hosted':
        return new HostedAPIProvider(getCfg('hosted', 'hosted'), secrets);
      case 'geminiCli':
      case 'gemini_cli':
        return new GeminiCliProvider(await withDetectedCommand(getCfg('geminiCli', 'gemini_cli'), 'gemini'), secrets);
      case 'claudeCode':
      case 'claude_code':
      case 'claude':
        return new ClaudeCodeProvider(await withDetectedCommand(getCfg('claude', 'claude_code'), 'claude'), secrets);
      case 'openAiCli':
      case 'openai_cli':
      case 'openai':
        return new OpenAiCliProvider(await withDetectedCommand(getCfg('openAiCli', 'openai_cli'), 'codex', 'openai'), secrets);
      default:
        // Check if it's a custom CLI
        const customClis = settings.customClis || settings.custom_clis || [];
        if (Array.isArray(customClis)) {
          const custom = customClis.find(c => 
            c.id === type || 
            `custom-${c.id}` === type ||
            c.name === type ||
            `custom-${c.name}` === type
          );
          if (custom) {
            return new CustomCliProvider(custom, secrets);
          }
        }
        // Fallback to Hosted API if unknown
        return new HostedAPIProvider(getCfg('hosted', 'hosted'), secrets);
    }
  }
}
