import { AIProvider } from './base.mjs';
import { spawn } from 'node:child_process';

export class ClaudeCodeProvider extends AIProvider {
  constructor(config) {
    super();
    this.config = config;
  }

  async chat(request) {
    const args = ['chat', '--model', this.config.model || 'claude-3-5-sonnet-latest'];
    const input = request.messages[request.messages.length - 1].content;
    
    return new Promise((resolve, reject) => {
      const child = spawn(this.config.command || 'claude', args);
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
          reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
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
    return 'claudeCode';
  }

  metadata() {
    return {
      id: 'claude_code',
      name: 'Claude Code',
      description: 'Anthropic Claude via CLI',
      capabilities: ['chat'],
      models: [this.config.model || 'claude-3-5-sonnet-latest'],
    };
  }
}
