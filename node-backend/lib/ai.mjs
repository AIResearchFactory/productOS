import { OllamaProvider } from './providers/ollama.mjs';
import { HostedAPIProvider } from './providers/hosted.mjs';
import { GeminiCliProvider } from './providers/gemini.mjs';
import { ClaudeCodeProvider } from './providers/claude.mjs';
import { OpenAiCliProvider } from './providers/openai.mjs';
import { CustomCliProvider } from './providers/custom.mjs';

export class AIService {
  static async createProvider(providerType, settings, secrets = {}) {
    const type = String(providerType || settings.activeProvider || settings.active_provider || '');
    const getCfg = (keyCamel, keySnake) => settings[keyCamel] || settings[keySnake] || {};

    switch (type) {
      case 'ollama':
        return new OllamaProvider(getCfg('ollama', 'ollama'), secrets);
      case 'hostedApi':
      case 'hosted':
        return new HostedAPIProvider(getCfg('hosted', 'hosted'), secrets);
      case 'geminiCli':
      case 'gemini_cli':
        return new GeminiCliProvider(getCfg('geminiCli', 'gemini_cli'), secrets);
      case 'claudeCode':
      case 'claude_code':
      case 'claude':
        return new ClaudeCodeProvider(getCfg('claude', 'claude_code'), secrets);
      case 'openAiCli':
      case 'openai_cli':
      case 'openai':
        return new OpenAiCliProvider(getCfg('openAiCli', 'openai_cli'), secrets);
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
