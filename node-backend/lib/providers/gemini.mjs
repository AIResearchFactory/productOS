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
    const args = ['chat', '--model', model];
    
    const env = { ...process.env };
    const apiKeySecretId = this.config.apiKeySecretId || 'gemini_api_key';
    const apiKey = this.secrets[apiKeySecretId] || this.secrets['GEMINI_API_KEY'] || this.secrets['GOOGLE_API_KEY'];
    if (apiKey) {
      env[this.config.apiKeyEnvVar || 'GEMINI_API_KEY'] = apiKey;
    }

    const input = request.messages[request.messages.length - 1].content;
    
    return new Promise((resolve, reject) => {
      const child = spawn(this.config.command || 'gemini', args, { env });
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
