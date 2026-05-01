import { AIProvider } from './base.mjs';
import { spawn } from 'node:child_process';

export class CustomCliProvider extends AIProvider {
  constructor(config) {
    super();
    this.config = config;
  }

  async chat(request) {
    const args = (this.config.args || []).map(arg => {
        if (arg === '{{input}}') return request.messages[request.messages.length - 1].content;
        return arg;
    });

    return new Promise((resolve, reject) => {
      const child = spawn(this.config.command, args);
      let stdout = '';
      let stderr = '';

      // If there is no {{input}} in args, maybe send to stdin?
      if (!this.config.args?.includes('{{input}}')) {
          child.stdin.write(request.messages[request.messages.length - 1].content);
          child.stdin.end();
      }

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
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
