import { AIProvider } from './base.mjs';
import { spawn } from 'node:child_process';

export class ClaudeCodeProvider extends AIProvider {
  constructor(config) {
    super();
    this.config = config;
  }

  async chat(request) {
    const input = request.messages[request.messages.length - 1].content;
    const model = this.config.model || 'claude-3-5-sonnet-latest';
    // --dangerously-skip-permissions: allow Claude Code to create/edit files automatically
    // (replaces deprecated --accept-raw-output-risk flag removed in newer Claude CLI versions)
    const args = [input, '--model', model, '--output-format', 'text', '--dangerously-skip-permissions'];
    
    return new Promise((resolve, reject) => {
      try {
        const child = spawn(this.config.command || 'claude', args);
        let stdout = '';
        let stderr = '';

        child.on('error', (err) => {
          reject(new Error(`Failed to start Claude CLI: ${err.message}`));
        });

        child.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        child.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
          } else {
            // Clean up output: Claude CLI might include some headers/footers
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
          child = spawn(this.config.command || 'claude', ['auth', 'status']);
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
