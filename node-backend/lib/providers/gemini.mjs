import { AIProvider } from './base.mjs';
import { spawn } from 'node:child_process';

export class GeminiCliProvider extends AIProvider {
  constructor(config) {
    super();
    this.config = config;
  }

  async chat(request) {
    // Use 'gemini chat' command
    const args = ['chat', '--model', this.config.model_alias || 'pro'];
    if (request.system_prompt) {
      // In Gemini CLI, system prompt might be passed via --system or as the first message
      // Depending on the CLI version. Assuming it's passed as part of the messages for now.
    }

    const input = request.messages[request.messages.length - 1].content;
    
    return new Promise((resolve, reject) => {
      const child = spawn(this.config.command || 'gemini', args);
      let stdout = '';
      let stderr = '';

      child.stdin.write(input);
      child.stdin.end();

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Gemini CLI exited with code ${code}: ${stderr}`));
        } else {
          resolve({
            content: stdout.trim(),
            tool_calls: null,
            metadata: null,
          });
        }
      });
    });
  }

  async checkAuthentication() {
    return new Promise((resolve) => {
        const child = spawn(this.config.command || 'gemini', ['auth', 'status']);
        child.on('close', (code) => resolve(code === 0));
    });
  }

  providerType() {
    return 'geminiCli';
  }

  metadata() {
    return {
      id: 'gemini_cli',
      name: 'Gemini CLI',
      description: 'Google Gemini via CLI',
      capabilities: ['chat'],
      models: [this.config.model_alias || 'pro'],
    };
  }
}
