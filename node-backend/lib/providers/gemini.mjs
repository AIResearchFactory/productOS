import { AIProvider } from './base.mjs';
import { spawn } from 'node:child_process';

export class GeminiCliProvider extends AIProvider {
  constructor(config, secrets = {}) {
    super();
    this.config = config;
    this.secrets = secrets;
  }

  async chat(request) {
    const model = this.config.model_alias || this.config.modelAlias || 'pro';
    const input = request.messages[request.messages.length - 1].content;
    const args = [input, '--model', model, '--output-format', 'text'];
    
    const env = { ...process.env };
    const apiKeySecretId = this.config.apiKeySecretId || 'gemini_api_key';
    const apiKey = this.secrets[apiKeySecretId] || this.secrets['GEMINI_API_KEY'] || this.secrets['GOOGLE_API_KEY'];
    if (apiKey) {
      env[this.config.apiKeyEnvVar || 'GEMINI_API_KEY'] = apiKey;
    }

    return new Promise((resolve, reject) => {
      try {
        const child = spawn(this.config.command || 'gemini', args, { env });
        let stdout = '';
        let stderr = '';

        child.on('error', (err) => {
          reject(new Error(`Failed to start Gemini CLI: ${err.message}`));
        });

        child.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
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
      } catch (err) {
        reject(err);
      }
    });
  }

  async checkAuthentication() {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          if (child) child.kill();
          resolve(false);
        }, 5000);

        let child;
        try {
          child = spawn(this.config.command || 'gemini', ['auth', 'status']);
          child.on('error', () => {
            clearTimeout(timeout);
            resolve(false);
          });
          child.on('close', (code) => {
            clearTimeout(timeout);
            resolve(code === 0);
          });
        } catch {
          clearTimeout(timeout);
          resolve(false);
        }
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
