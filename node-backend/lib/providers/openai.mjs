import { AIProvider } from './base.mjs';
import { spawn } from 'node:child_process';

export class OpenAiCliProvider extends AIProvider {
  constructor(config, secrets = {}) {
    super();
    this.config = config;
    this.secrets = secrets;
  }

  async chat(request) {
    const isCodex = (this.config.command || '').toLowerCase().includes('codex');
    const model = this.config.model || 'gpt-4o';
    
    let args = [];
    if (isCodex) {
      args = ['exec', '--skip-git-repo-check', '-c', 'model_provider_options.store=false'];
      if (model !== 'auto') {
        args.push('--model', model);
      }
    } else {
      args = ['chat', '--model', model];
    }
    
    const env = { ...process.env };
    const apiKeySecretId = this.config.apiKeySecretId || 'openai_api_key';
    let apiKey = this.secrets[apiKeySecretId] || this.secrets['OPENAI_API_KEY'];
    
    // Fallback to OAuth token if no API key
    if (!apiKey) {
      apiKey = this.secrets['OPENAI_OAUTH_ACCESS_TOKEN'];
    }

    if (apiKey) {
      env[this.config.apiKeyEnvVar || 'OPENAI_API_KEY'] = apiKey;
    }

    const input = request.messages[request.messages.length - 1].content;
    if (isCodex) {
      args.push(input);
    }

    return new Promise((resolve, reject) => {
      try {
        const child = spawn(this.config.command || 'openai', args, { env });
        let stdout = '';
        let stderr = '';

        child.on('error', (err) => {
          reject(new Error(`Failed to start OpenAI/Codex CLI: ${err.message}`));
        });

        if (child.stdin && !isCodex) {
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
    // 1. Check for stored API key or OAuth token
    const apiKeySecretId = this.config.apiKeySecretId || 'openai_api_key';
    const hasKey = !!(this.secrets[apiKeySecretId] || this.secrets['OPENAI_API_KEY'] || this.secrets['OPENAI_OAUTH_ACCESS_TOKEN']);
    if (hasKey) return true;

    // 2. Check CLI login status if it's codex
    const isCodex = (this.config.command || '').toLowerCase().includes('codex');
    if (isCodex) {
      return new Promise((resolve) => {
        try {
          const child = spawn(this.config.command || 'codex', ['login', 'status']);
          let output = '';
          child.stdout?.on('data', (d) => output += d.toString());
          child.stderr?.on('data', (d) => output += d.toString());
          child.on('error', () => resolve(false));
          child.on('close', (code) => {
            const normalized = output.toLowerCase();
            const connected = code === 0 && 
              !normalized.includes('not logged') && 
              !normalized.includes('not authenticated') && 
              !normalized.includes('login required');
            resolve(connected);
          });
        } catch {
          resolve(false);
        }
      });
    }

    return false;
  }

  providerType() {
    return 'openAiCli';
  }

  metadata() {
    return {
      id: 'openai_cli',
      name: 'OpenAI CLI',
      description: 'OpenAI via CLI or Codex CLI',
      capabilities: ['chat', 'stream'],
      models: [this.config.model || 'gpt-4o'],
    };
  }
}
