import { AIProvider } from './base.mjs';
import { spawn } from 'node:child_process';

export class OpenAiCliProvider extends AIProvider {
  constructor(config) {
    super();
    this.config = config;
  }

  async chat(request) {
    const args = ['chat', '--model', this.config.model || 'gpt-4o'];
    const input = request.messages[request.messages.length - 1].content;
    
    return new Promise((resolve, reject) => {
      const child = spawn(this.config.command || 'openai', args);
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
          reject(new Error(`OpenAI CLI exited with code ${code}: ${stderr}`));
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

  providerType() {
    return 'openAiCli';
  }

  metadata() {
    return {
      id: 'openai_cli',
      name: 'OpenAI CLI',
      description: 'OpenAI via CLI',
      capabilities: ['chat'],
      models: [this.config.model || 'gpt-4o'],
    };
  }
}
