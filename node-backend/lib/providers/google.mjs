import { AIProvider, spawnCli } from './base.mjs';
import { checkCli, resolveCliCommand } from '../system.mjs';
import { spawn } from 'node:child_process';
import path from 'node:path';

export class GoogleCliProvider extends AIProvider {
  constructor(config = {}, secrets = {}, projectPath = null) {
    super();
    this.config = config;
    this.secrets = secrets;
    this.projectPath = projectPath;
  }

  async resolveCommand() {
    if (this.config?.command && path.isAbsolute(this.config.command)) {
      return this.config.command;
    }
    const targetCommand = this.config?.command || 'agy';
    const detected = await resolveCliCommand(targetCommand, 'agy', 'gemini');
    if (detected.installed && detected.path) {
      return detected.path;
    }
    return targetCommand;
  }

  async chat(request) {
    const { onDelta, signal } = request;
    const configuredModel = this.config.model_alias || this.config.modelAlias || this.config.model;
    const input = this.buildCliInput(request);
    const command = await this.resolveCommand();
    const isAgy = command.includes('agy');

    const args = ['--prompt', input, '--output-format', 'text'];
    const isLegacyModel = !configuredModel || ['pro', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'default'].includes(configuredModel);
    if (configuredModel && !isLegacyModel) {
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
        const spawnOptions = { env, signal };
        if (this.projectPath) {
          spawnOptions.cwd = this.projectPath;
        }
        const child = spawnCli(spawn, command, args, spawnOptions);
        let stdout = '';
        let stderr = '';

        child.on('error', (err) => {
          if (signal?.aborted) return;
          reject(new Error(`Failed to start ${isAgy ? 'Google Antigravity CLI' : 'Gemini CLI'} (${command}): ${err.message}`));
        });

        if (child.stdin) {
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
            const cliDisplayName = isAgy ? 'Google Antigravity CLI (agy)' : 'Gemini CLI';
            let errorMsg = `${cliDisplayName} exited with code ${code}: ${stderr}`;
            const lowerErr = stderr.toLowerCase();
            if (
              lowerErr.includes('ineligibletiererror') ||
              lowerErr.includes('unsupported_client') ||
              lowerErr.includes('gemini code assist') ||
              lowerErr.includes('antigravity')
            ) {
              errorMsg = `Gemini Code Assist individual OAuth tier is no longer supported by Google. Please use Google Antigravity CLI (agy) or obtain a Gemini API key from Google AI Studio (https://aistudio.google.com/app/apikey) and enter it in Settings → Models (or set GEMINI_API_KEY). Original error: ${stderr}`;
            } else if (
              lowerErr.includes('authentication') ||
              lowerErr.includes('login') ||
              lowerErr.includes('api key') ||
              lowerErr.includes('fatalcancellationerror')
            ) {
              errorMsg = `${cliDisplayName} authentication failed. Please authenticate ${isAgy ? 'agy' : 'gemini'} in terminal, or provide a valid Gemini API key in Settings → Models. Original error: ${stderr}`;
            }
            reject(new Error(errorMsg));
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

  async listModels() {
    const command = await this.resolveCommand();
    const isAgy = command.includes('agy');
    if (!isAgy) {
      return ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'];
    }

    try {
      const { execFile } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execFileAsync = promisify(execFile);
      
      const { stdout, stderr } = await execFileAsync(command, ['--prompt', 'list-models-query', '--model', '__invalid_model_list__'], { timeout: 3000 }).catch(err => err);
      const output = `${stdout || ''}\n${stderr || ''}`;
      const models = [];
      const lines = output.split('\n');
      let capture = false;
      for (const line of lines) {
        if (line.toLowerCase().includes('available models:')) {
          capture = true;
          continue;
        }
        if (capture) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('Usage:') && !trimmed.startsWith('Error:')) {
            models.push(trimmed);
          } else if (trimmed.length === 0 && models.length > 0) {
            break;
          }
        }
      }
      if (models.length > 0) return models;
    } catch {
      // Fallback
    }

    return [
      'Gemini 3.6 Flash (High)',
      'Gemini 3.6 Flash (Medium)',
      'Gemini 3.6 Flash (Low)',
      'Gemini 3.5 Flash (High)',
      'Gemini 3.5 Flash (Medium)',
      'Gemini 3.5 Flash (Low)',
      'Gemini 3.1 Pro (High)',
      'Gemini 3.1 Pro (Low)',
    ];
  }

  async checkAuthentication() {
    const apiKeySecretId = this.config.apiKeySecretId || 'gemini_api_key';
    const hasKey = !!(this.secrets[apiKeySecretId] || this.secrets['GEMINI_API_KEY'] || this.secrets['GOOGLE_API_KEY']);
    if (hasKey) return true;

    const command = await this.resolveCommand();
    const cli = await checkCli(command);
    if (cli.installed) return true;
    const fallbackCli = await checkCli('gemini');
    return fallbackCli.installed;
  }

  providerType() {
    return 'geminiCli';
  }

  metadata() {
    const configuredModel = this.config.model_alias || this.config.modelAlias || this.config.model;
    return {
      id: 'gemini_cli',
      name: 'Google Antigravity',
      description: 'Google Antigravity / Gemini via CLI',
      capabilities: ['chat'],
      models: [configuredModel || 'default'],
    };
  }
}

export const GeminiCliProvider = GoogleCliProvider;
