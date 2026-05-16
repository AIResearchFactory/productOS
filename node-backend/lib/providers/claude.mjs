import { AIProvider, spawnCli } from './base.mjs';
import { spawn } from 'node:child_process';

export class ClaudeCodeProvider extends AIProvider {
  constructor(config = {}, secrets = {}, projectPath = null) {
    super();
    this.config = config;
    this.secrets = secrets;
    this.projectPath = projectPath;
  }

  async chat(request) {
    const { onDelta, signal } = request;
    const input = this.buildCliInput(request);
    const configuredModel = this.config.model || this.config.modelAlias || this.config.model_alias;
    const legacyDefaults = new Set(['claude-3-5-sonnet-20241022', 'claude-3-5-sonnet-latest']);
    // --print makes Claude Code non-interactive and reads stdin. Avoid forcing
    // old app defaults; the CLI's account-compatible default is safer.
    const args = ['--print', '--output-format', 'text', '--dangerously-skip-permissions'];
    if (configuredModel && !legacyDefaults.has(configuredModel)) args.push('--model', configuredModel);
    
    return new Promise((resolve, reject) => {
      try {
        const command = this.config.command || 'claude';
        const spawnOptions = { signal };
        if (this.projectPath) {
          spawnOptions.cwd = this.projectPath;
        }
        const child = spawnCli(spawn, command, args, spawnOptions);
        let stdout = '';
        let stderr = '';

        child.on('error', (err) => {
          if (signal?.aborted) return;
          reject(new Error(`Failed to start Claude CLI: ${err.message}`));
        });

        // Send full context via stdin
        if (child.stdin) {
          child.stdin.write(input);
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
          const command = this.config.command || 'claude';
          child = spawnCli(spawn, command, ['auth', 'status']);
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
      models: [this.config.model || this.config.modelAlias || this.config.model_alias || 'default'],
    };
  }
}
