import { AIProvider } from './base.mjs';
import { spawn } from 'node:child_process';

export class OpenAiCliProvider extends AIProvider {
  constructor(config, secrets = {}) {
    super();
    this.config = config;
    this.secrets = secrets;
  }

  async chat(request) {
    const args = ['chat', '--model', this.config.model || 'gpt-4o'];
    
    const env = { ...process.env };
    const apiKeySecretId = this.config.apiKeySecretId || 'openai_api_key';
    const apiKey = this.secrets[apiKeySecretId] || this.secrets['OPENAI_API_KEY'];
    if (apiKey) {
      env[this.config.apiKeyEnvVar || 'OPENAI_API_KEY'] = apiKey;
    }

    const input = request.messages[request.messages.length - 1].content;
    
    return new Promise((resolve, reject) => {
      try {
        const child = spawn(this.config.command || 'openai', args, { env });
        let stdout = '';
        let stderr = '';

        child.on('error', (err) => {
          reject(new Error(`Failed to start OpenAI CLI: ${err.message}`));
        });

        if (child.stdin) {
          child.stdin.write(input);
          child.stdin.end();
        }

        child.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
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
      } catch (err) {
        reject(err);
      }
    });
  }

  async checkAuthentication() {
    return new Promise((resolve) => {
        try {
          const child = spawn(this.config.command || 'openai', ['auth', 'status']);
          child.on('error', () => resolve(false));
          child.on('close', (code) => resolve(code === 0));
        } catch {
          resolve(false);
        }
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
