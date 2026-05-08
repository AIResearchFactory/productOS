import { AIProvider, spawnCli } from './base.mjs';
import { spawn } from 'node:child_process';

export class GeminiCliProvider extends AIProvider {
  constructor(config = {}, secrets = {}) {
    super();
    this.config = config;
    this.secrets = secrets;
  }

  async chat(request) {
    const configuredModel = this.config.model_alias || this.config.modelAlias || this.config.model;
    const input = this.buildCliInput(request);
    // Use headless prompt mode and send the full context via stdin. Passing '-'
    // as a positional prompt starts interactive mode in current Gemini CLI builds.
    const args = ['--prompt', '-', '--output-format', 'text'];
    if (configuredModel && configuredModel !== 'pro') {
      args.push('--model', configuredModel);
    }
    
    const env = { ...process.env };
    const apiKeySecretId = this.config.apiKeySecretId || 'gemini_api_key';
    const apiKey = this.secrets[apiKeySecretId] || this.secrets['GEMINI_API_KEY'] || this.secrets['GOOGLE_API_KEY'];
    if (apiKey) {
      env[this.config.apiKeyEnvVar || 'GEMINI_API_KEY'] = apiKey;
    }

    return new Promise((resolve, reject) => {
      try {
        const command = this.config.command || 'gemini';
        const child = spawnCli(spawn, command, args, { env });
        let stdout = '';
        let stderr = '';

        child.on('error', (err) => {
          reject(new Error(`Failed to start Gemini CLI: ${err.message}`));
        });

        // Send full context via stdin
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
    const apiKeySecretId = this.config.apiKeySecretId || 'gemini_api_key';
    const hasKey = !!(this.secrets[apiKeySecretId] || this.secrets['GEMINI_API_KEY'] || this.secrets['GOOGLE_API_KEY']);
    if (hasKey) return true;

    // Gemini CLI does not expose a stable `auth status` command. If the CLI is
    // installed, allow chat to proceed and surface any real auth error from the
    // actual request instead of blocking healthy OAuth sessions during preflight.
    return true;
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
      models: [this.config.model_alias || this.config.modelAlias || this.config.model || 'default'],
    };
  }
}
