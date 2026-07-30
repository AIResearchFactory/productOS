import { AIProvider, spawnCli } from './base.mjs';
import { checkCli } from '../system.mjs';
import { spawn } from 'node:child_process';

export class GeminiCliProvider extends AIProvider {
  constructor(config = {}, secrets = {}, projectPath = null) {
    super();
    this.config = config;
    this.secrets = secrets;
    this.projectPath = projectPath;
  }

  async chat(request) {
    const { onDelta, signal } = request;
    const configuredModel = this.config.model_alias || this.config.modelAlias || this.config.model;
    const input = this.buildCliInput(request);
    // Use headless prompt mode and send the full context via stdin. Passing '-'
    // as a positional prompt starts interactive mode in current Gemini CLI builds.
    const args = ['--prompt', '-', '--output-format', 'text'];
    // Gemini CLI defaults to the 'pro' model; only append --model if a different
    // alias is explicitly configured.
    if (configuredModel && configuredModel !== 'pro') {
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
        const command = this.config.command || 'gemini';
        const spawnOptions = { env, signal };
        if (this.projectPath) {
          spawnOptions.cwd = this.projectPath;
        }
        const child = spawnCli(spawn, command, args, spawnOptions);
        let stdout = '';
        let stderr = '';

        child.on('error', (err) => {
          if (signal?.aborted) return;
          reject(new Error(`Failed to start Gemini CLI: ${err.message}`));
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
            let errorMsg = `Gemini CLI exited with code ${code}: ${stderr}`;
            const lowerErr = stderr.toLowerCase();
            if (
              lowerErr.includes('ineligibletiererror') ||
              lowerErr.includes('unsupported_client') ||
              lowerErr.includes('gemini code assist') ||
              lowerErr.includes('antigravity')
            ) {
              errorMsg = `Gemini Code Assist individual OAuth tier is no longer supported by Google. Please obtain a Gemini API key from Google AI Studio (https://aistudio.google.com/app/apikey) and enter it in Settings → Models (or set GEMINI_API_KEY). Original error: ${stderr}`;
            } else if (lowerErr.includes('authentication') || lowerErr.includes('login') || lowerErr.includes('api key')) {
              errorMsg = `Gemini CLI authentication failed. Please provide a valid Gemini API key in Settings → Models or set GEMINI_API_KEY environment variable. Original error: ${stderr}`;
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

  async checkAuthentication() {
    const apiKeySecretId = this.config.apiKeySecretId || 'gemini_api_key';
    const hasKey = !!(this.secrets[apiKeySecretId] || this.secrets['GEMINI_API_KEY'] || this.secrets['GOOGLE_API_KEY']);
    if (hasKey) return true;

    const command = this.config.command || 'agy';
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
      models: [configuredModel || 'gemini-2.0-flash'],
    };
  }
}
