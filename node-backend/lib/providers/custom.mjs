import { AIProvider } from './base.mjs';
import { spawn } from 'node:child_process';

export class CustomCliProvider extends AIProvider {
  constructor(config, secrets = {}) {
    super();
    this.config = config;
    this.secrets = secrets;
  }

  async chat(request) {
    // Build full conversation history so the CLI receives context, not just the last message.
    // Format: system prompt (if any) followed by all messages in chronological order.
    const lastMessage = request.messages[request.messages.length - 1].content;

    let fullContext = '';
    if (request.system_prompt) {
      fullContext += `[System]\n${request.system_prompt}\n\n`;
    }
    if (request.messages.length > 1) {
      for (const msg of request.messages.slice(0, -1)) {
        const role = msg.role === 'assistant' ? 'Assistant' : 'User';
        fullContext += `[${role}]\n${msg.content}\n\n`;
      }
      fullContext += `[User]\n${lastMessage}`;
    } else {
      fullContext += lastMessage;
    }

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
        const child = spawn(command, args, { env, shell: true });
        let stdout = '';
        let stderr = '';

        child.on('error', (err) => {
          reject(new Error(`Failed to start custom CLI "${this.config.name}": ${err.message}. (Command: ${command})`));
        });

        // If there is no {{input}} in args, send full context to stdin
        if (!this.config.args?.includes('{{input}}') && child.stdin) {
          child.stdin.write(fullContext);
          child.stdin.end();
        }

        child.stdout?.on('data', (data) => { stdout += data.toString(); });
        child.stderr?.on('data', (data) => { stderr += data.toString(); });

        child.on('close', (code) => {
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
