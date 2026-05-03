import { AIProvider } from './base.mjs';
import { spawn } from 'node:child_process';

export class CustomCliProvider extends AIProvider {
  constructor(config, secrets = {}) {
    super();
    this.config = config;
    this.secrets = secrets;
  }

  async chat(request) {
    const args = (this.config.args || []).map(arg => {
      if (arg === '{{input}}') return request.messages[request.messages.length - 1].content;
      return arg;
    });

    const env = { ...process.env };
    if (this.config.apiKeySecretId && this.secrets[this.config.apiKeySecretId]) {
      env[this.config.apiKeyEnvVar || 'API_KEY'] = this.secrets[this.config.apiKeySecretId];
    }

    let command = this.config.command;
    let finalArgs = [...args];

    // If command contains spaces and no args were provided, split it automatically
    if (command && command.includes(' ') && args.length === 0) {
      const parts = command.split(/\s+/);
      command = parts[0];
      finalArgs = parts.slice(1);
    }

    return new Promise((resolve, reject) => {
      try {
        const child = spawn(command, finalArgs, { env });

        let stdout = '';
        let stderr = '';

        child.on('error', (err) => {
          reject(new Error(`Failed to start custom CLI "${this.config.name}": ${err.message}. (Path: ${command})`));
        });

        // If there is no {{input}} in args, maybe send to stdin?
        if (!this.config.args?.includes('{{input}}') && child.stdin) {
          child.stdin.write(request.messages[request.messages.length - 1].content);
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
            reject(new Error(`Custom CLI ${this.config.name} exited with code ${code}: ${stderr}`));
          } else {
            resolve({
              content: stdout.trim(),
              tool_calls: null,
              metadata: null,
            });
          }
        });
      } catch (err) {
        reject(new Error(`Unexpected error spawning ${this.config.name}: ${err.message}`));
      }
    });
  }

  async listModels() {
    return [this.config.model || 'custom-model'];
  }

  providerType() {
    return this.config.id || 'customCli';
  }

  metadata() {
    return {
      id: this.config.id || 'custom',
      name: this.config.name || 'Custom CLI',
      description: this.config.description || '',
      capabilities: ['chat'],
      models: [this.config.model || 'custom-model'],
    };
  }
}
