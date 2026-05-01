import { OllamaProvider } from './providers/ollama.mjs';
import { HostedAPIProvider } from './providers/hosted.mjs';
import { GeminiCliProvider } from './providers/gemini.mjs';
import { ClaudeCodeProvider } from './providers/claude.mjs';
import { OpenAiCliProvider } from './providers/openai.mjs';
import { CustomCliProvider } from './providers/custom.mjs';

export class AIService {
  static async createProvider(providerType, settings) {
    const type = String(providerType || '');
    switch (type) {
      case 'ollama':
        return new OllamaProvider(settings.ollama || {});
      case 'hostedApi':
        return new HostedAPIProvider(settings.hosted || {});
      case 'geminiCli':
        return new GeminiCliProvider(settings.gemini_cli || {});
      case 'claudeCode':
        return new ClaudeCodeProvider(settings.claude_code || {});
      case 'openAiCli':
        return new OpenAiCliProvider(settings.openai_cli || {});
      default:
        // Check if it's a custom CLI
        if (Array.isArray(settings.customClis)) {
          const custom = settings.customClis.find(c => 
            c.id === type || 
            `custom-${c.id}` === type ||
            c.name === type ||
            `custom-${c.name}` === type
          );
          if (custom) {
            return new CustomCliProvider(custom);
          }
        }
        // Fallback to Hosted API if unknown
        return new HostedAPIProvider(settings.hosted || {});
    }
  }
}
