import { AIProvider, spawnCli } from './base.mjs';
import { checkCli, resolveCliCommand, getEnhancedEnv } from '../system.mjs';
import { spawn } from 'node:child_process';
import path from 'node:path';

const MAX_ARG_PROMPT_LENGTH = process.platform === 'win32' ? 24000 : 120000;

function isAgyCommand(command) {
  return path.basename(String(command || '')).toLowerCase().includes('agy');
}

const MODEL_NAME_TO_ID = {
  'gemini 3.6 flash (high)': 'gemini-3.6-flash-high',
  'gemini 3.6 flash (medium)': 'gemini-3.6-flash-medium',
  'gemini 3.6 flash (low)': 'gemini-3.6-flash-low',
  'gemini 3.5 flash (high)': 'gemini-3.5-flash-high',
  'gemini 3.5 flash (medium)': 'gemini-3.5-flash-medium',
  'gemini 3.5 flash (low)': 'gemini-3.5-flash-low',
  'gemini 3.1 pro (high)': 'gemini-3.1-pro-high',
  'gemini 3.1 pro (low)': 'gemini-3.1-pro-low',
  'claude sonnet 4.6 (thinking)': 'claude-sonnet-4-6',
  'claude opus 4.6 (thinking)': 'claude-opus-4-6-thinking',
  'gpt-oss 120b (medium)': 'gpt-oss-120b-medium',
};

export class GoogleCliProvider extends AIProvider {
  constructor(config = {}, secrets = {}, projectPath = null) {
    super();
    this.config = config;
    this.secrets = secrets;
    this.projectPath = projectPath;
  }

  async displayName() {
    const command = await this.resolveCommand();
    return isAgyCommand(command) ? 'Google Antigravity CLI (agy)' : 'Gemini CLI (gemini)';
  }

  async resolveCommand() {
    if (this.config?.command && path.isAbsolute(this.config.command)) {
      return this.config.command;
    }
    const userCmd = (this.config?.command && !['gemini', 'geminiCli', 'default'].includes(this.config.command))
      ? this.config.command
      : 'agy';
    const detected = await resolveCliCommand(userCmd, 'agy', 'gemini');
    if (detected.installed && detected.path) {
      return detected.path;
    }
    return userCmd;
  }

  async chat(request) {
    const { onDelta, signal } = request;
    let configuredModel = this.config.model_alias || this.config.modelAlias || this.config.model;
    if (configuredModel && MODEL_NAME_TO_ID[configuredModel.toLowerCase()]) {
      configuredModel = MODEL_NAME_TO_ID[configuredModel.toLowerCase()];
    }

    const input = this.buildCliInput(request);
    const command = await this.resolveCommand();
    const isAgy = isAgyCommand(command);
    const cliDisplayName = isAgy ? 'Google Antigravity CLI (agy)' : 'Gemini CLI';

    // agy currently treats `--prompt -` as a literal dash, while Gemini CLI
    // supports stdin. Keep argv prompts scoped to agy and fail before hitting
    // OS command-line limits with large project-context prompts.
    if (isAgy && input.length > MAX_ARG_PROMPT_LENGTH) {
      throw new Error(`${cliDisplayName} prompt is too large to pass safely as a command-line argument (${input.length} chars). Reduce project context or switch to a CLI/provider that supports stdin prompt input.`);
    }

    const args = ['--prompt', isAgy ? input : '-', '--output-format', 'text', '--dangerously-skip-permissions'];
    const isLegacyModel = !configuredModel || ['pro', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'default'].includes(configuredModel);
    if (configuredModel && !isLegacyModel) {
      args.push('--model', configuredModel);
    }
    
    const env = getEnhancedEnv();
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
          reject(new Error(`Failed to start ${cliDisplayName} (${command}): ${err.message}`));
        });

        if (child.stdin) {
          if (!isAgy) {
            child.stdin.write(input);
          }
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

          const finalContent = stdout.trim();
          if (code === 0 && finalContent) {
            resolve({
              content: finalContent,
              tool_calls: null,
              metadata: null,
            });
            return;
          }

          const errorOutput = stderr.trim() || stdout.trim();
          const lowerError = errorOutput.toLowerCase();
          const isAuthPrompt = lowerError.includes('opening authentication page') ||
                               lowerError.includes('do you want to continue?') ||
                               lowerError.includes('unauthorized') ||
                               lowerError.includes('login required');

          if (
            lowerError.includes('ineligibletiererror') ||
            lowerError.includes('unsupported_client') ||
            lowerError.includes('gemini code assist') ||
            lowerError.includes('failed to authenticate antigravity')
          ) {
            reject(new Error(`Gemini Code Assist individual OAuth tier is no longer supported by Google. Please use Google Antigravity CLI (agy) or obtain a Gemini API key from Google AI Studio (https://aistudio.google.com/app/apikey) and enter it in Settings → Models (or set GEMINI_API_KEY). Original output: ${errorOutput}`));
            return;
          }
          if (isAuthPrompt || lowerError.includes('authentication') || lowerError.includes('login') || lowerError.includes('api key') || lowerError.includes('fatalcancellationerror')) {
            reject(new Error(`${cliDisplayName} authentication required. Please authenticate ${isAgy ? 'agy' : 'gemini'} in terminal, or provide a valid Gemini API key in Settings → Models. Original output: ${errorOutput}`));
            return;
          }
          if (!finalContent) {
            const detail = stderr.trim() ? `: ${stderr.trim()}` : '';
            reject(new Error(`${cliDisplayName} returned an empty response${detail}. Ensure the CLI is logged in and working.`));
            return;
          }
          reject(new Error(`${cliDisplayName} exited with code ${code}: ${stderr}`));
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async listModels() {
    const command = await this.resolveCommand();
    const isAgy = isAgyCommand(command);
    if (!isAgy) {
      return ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'];
    }

    const fallbackModels = [
      { id: 'gemini-3.6-flash-high', name: 'Gemini 3.6 Flash (High)' },
      { id: 'gemini-3.6-flash-medium', name: 'Gemini 3.6 Flash (Medium)' },
      { id: 'gemini-3.6-flash-low', name: 'Gemini 3.6 Flash (Low)' },
      { id: 'gemini-3.5-flash-high', name: 'Gemini 3.5 Flash (High)' },
      { id: 'gemini-3.5-flash-medium', name: 'Gemini 3.5 Flash (Medium)' },
      { id: 'gemini-3.5-flash-low', name: 'Gemini 3.5 Flash (Low)' },
      { id: 'gemini-3.1-pro-high', name: 'Gemini 3.1 Pro (High)' },
      { id: 'gemini-3.1-pro-low', name: 'Gemini 3.1 Pro (Low)' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (Thinking)' },
      { id: 'claude-opus-4-6-thinking', name: 'Claude Opus 4.6 (Thinking)' },
      { id: 'gpt-oss-120b-medium', name: 'GPT-OSS 120B (Medium)' },
    ];

    try {
      const { execFile } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execFileAsync = promisify(execFile);
      
      const { stdout, stderr } = await execFileAsync(command, ['models'], { timeout: 4000, env: getEnhancedEnv() });
      const output = `${stdout || ''}\n${stderr || ''}`;
      const models = [];
      const lines = output.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.toLowerCase().startsWith('usage:') || trimmed.toLowerCase().startsWith('error:')) continue;
        const match = trimmed.match(/^(\S+)\s+(.+)$/);
        if (match) {
          models.push({ id: match[1].trim(), name: match[2].trim() });
        } else if (trimmed && !trimmed.includes(' ')) {
          models.push({ id: trimmed, name: trimmed });
        }
      }
      if (models.length > 0) return models;
    } catch {
      // Fallback
    }

    return fallbackModels;
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
