import { AIProvider, spawnCli } from './base.mjs';
import { spawn } from 'node:child_process';

export class CustomCliProvider extends AIProvider {
  constructor(config, secrets = {}, projectPath = null) {
    super();
    this.config = config;
    this.secrets = secrets;
    this.projectPath = projectPath;
  }

  async chat(request) {
    const { onDelta, signal } = request;
    // Use the shared CLI context builder from AIProvider base class.
    // This formats system_prompt + full message history consistently across all CLI providers.
    const fullContext = this.buildCliInput(request);

    const args = (this.config.args || []).map(arg => {
      if (arg === '{{input}}') return fullContext;
      return arg;
    });

    const env = { ...process.env };
    if (this.config.apiKeySecretId && this.secrets[this.config.apiKeySecretId]) {
      env[this.config.apiKeyEnvVar || 'API_KEY'] = this.secrets[this.config.apiKeySecretId];
    }

    const command = this.config.command;

    return new Promise((resolve, reject) => {
      try {
        const spawnOptions = { env, shell: true, signal };
        if (this.projectPath) {
          spawnOptions.cwd = this.projectPath;
        }
        const child = spawnCli(spawn, command, args, spawnOptions);
        let stdout = '';
        let stderr = '';

        child.on('error', (err) => {
          if (signal?.aborted) return;
          reject(new Error(`Failed to start custom CLI "${this.config.name}": ${err.message}. (Command: ${command})`));
        });

        // If there is no {{input}} in args, send full context to stdin
        if (!this.config.args?.includes('{{input}}') && child.stdin) {
          child.stdin.write(fullContext);
          child.stdin.end();
        }

        child.stdout?.on('data', (data) => {
          const chunk = data.toString();
          stdout += chunk;
          if (onDelta) onDelta(chunk);
        });

        child.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        child.on('close', (code) => {
          if (signal?.aborted) {
            resolve({ content: stdout.trim() + '\n\n_Stopped._', tool_calls: null, metadata: null });
            return;
          }
          if (code !== 0) {
            reject(new Error(`Custom CLI ${this.config.name} exited with code ${code}: ${stderr}`));
          } else {
            resolve({ content: stdout.trim(), tool_calls: null, metadata: null });
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
