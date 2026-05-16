import { AIProvider, spawnCli } from './base.mjs';
import { spawn } from 'node:child_process';

export class OpenAiCliProvider extends AIProvider {
  constructor(config, secrets = {}, projectPath = null) {
    super();
    this.config = config;
    this.secrets = secrets;
    this.projectPath = projectPath;
  }

  async chat(request) {
    const { onDelta, signal } = request;
    const isCodex = (this.config.command || '').toLowerCase().includes('codex');
    const configuredModel = this.config.model || this.config.modelAlias;
    const input = this.buildCliInput(request);
    
    let args = [];
    if (isCodex) {
      args = ['exec', '--skip-git-repo-check', '-c', 'model_provider_options.store=false'];
      // Codex defaults to the user's account-compatible model. Do not force the
      // legacy OpenAI CLI default (gpt-4o), which ChatGPT-backed Codex rejects.
      if (configuredModel && configuredModel !== 'auto' && !['gpt-4o', 'gpt-4o-mini'].includes(configuredModel)) {
        args.push('--model', configuredModel);
      }
    } else {
      const model = configuredModel || 'gpt-4o';
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

    return new Promise((resolve, reject) => {
      try {
        const command = this.config.command || 'codex';
        const spawnOptions = { env, signal };
        if (this.projectPath) {
          spawnOptions.cwd = this.projectPath;
        }
        const child = spawnCli(spawn, command, args, spawnOptions);
        let stdout = '';
        let stderr = '';

        child.on('error', (err) => {
          if (signal?.aborted) return;
          reject(new Error(`Failed to start OpenAI/Codex CLI: ${err.message}`));
        });

        // Send the prompt via stdin for both CLI families. This avoids Windows
        // cmd-shim quoting issues with multiline prompts and gives Codex EOF.
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
        const timeout = setTimeout(() => {
          if (child) child.kill();
          resolve(false);
        }, 5000);

        let child;
        try {
          const command = this.config.command || 'codex';
          child = spawnCli(spawn, command, ['login', 'status']);
          let output = '';
          child.stdout?.on('data', (d) => output += d.toString());
          child.stderr?.on('data', (d) => output += d.toString());
          child.on('error', () => {
            clearTimeout(timeout);
            resolve(false);
          });
          child.on('close', (code) => {
            clearTimeout(timeout);
            const normalized = output.toLowerCase();
            const connected = code === 0 && 
              !normalized.includes('not logged') && 
              !normalized.includes('not authenticated') && 
              !normalized.includes('login required');
            resolve(connected);
          });
        } catch {
          clearTimeout(timeout);
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
