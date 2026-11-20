import { AIProvider, spawnCli, isCloudCustomCli } from './base.mjs';
import { findExecutable, getEnhancedEnv } from '../system.mjs';
import { existsSync, statSync } from 'node:fs';
import { spawn } from 'node:child_process';

const DANGEROUS_ENV_VARS = new Set([
  'PATH',
  'NODE_OPTIONS',
  'BASH_ENV',
  'ENV',
  'IFS',
  'SHELL',
  'COMSPEC',
  'PATHEXT',
  'LD_PRELOAD',
  'LD_LIBRARY_PATH',
  'DYLD_INSERT_LIBRARIES',
  'DYLD_LIBRARY_PATH',
  'PYTHONPATH',
  'PYTHONHOME',
  'RUBYOPT',
  'PERL5OPT',
]);
const SAFE_ENV_VAR_RE = /^[A-Z_][A-Z0-9_]*$/i;

function assertSafeApiKeyEnvVar(name) {
  const key = String(name || 'API_KEY').trim();
  const upper = key.toUpperCase();
  if (
    !SAFE_ENV_VAR_RE.test(key) ||
    DANGEROUS_ENV_VARS.has(upper) ||
    upper.startsWith('LD_') ||
    upper.startsWith('DYLD_') ||
    upper.startsWith('PYTHON') ||
    upper.startsWith('NODE_')
  ) {
    const err = new Error(`Blocked unsafe apiKeyEnvVar name: ${key}`);
    err.statusCode = 400;
    throw err;
  }
  return key;
}

function defaultIsExistingFile(filePath) {
  try {
    return existsSync(filePath) && statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Tokenize a custom CLI command string into executable + inline args without invoking a shell.
 *
 * @param {string} rawCommand
 * @param {{ platform?: string, pathExists?: (filePath: string) => boolean }} [options]
 * @returns {{ executable: string, inlineArgs: string[] }}
 */
export function parseCustomCommand(rawCommand, options = {}) {
  const { platform = process.platform, pathExists = defaultIsExistingFile } = options;

  if (typeof rawCommand !== 'string') {
    throw new Error('Custom CLI command is empty');
  }
  if (/[\0\r\n]/.test(rawCommand)) {
    throw new Error('Custom CLI command contains forbidden control characters');
  }

  const trimmed = rawCommand.trim();
  if (!trimmed) {
    throw new Error('Custom CLI command is empty');
  }

  if (pathExists(trimmed)) {
    return { executable: trimmed, inlineArgs: [] };
  }

  const tokens = [];
  let current = '';
  let inToken = false;
  let quote = null;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];

    if (quote === '\'') {
      if (ch === '\'') {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }

    if (quote === '"') {
      if (ch === '"') {
        quote = null;
      } else if (ch === '\\') {
        const next = trimmed[i + 1];
        if (next === '"') {
          current += '"';
          i += 1;
        } else if (platform !== 'win32' && next === '\\') {
          current += '\\';
          i += 1;
        } else {
          current += ch;
        }
      } else {
        current += ch;
      }
      continue;
    }

    if (/\s/.test(ch)) {
      if (inToken) {
        tokens.push(current);
        current = '';
        inToken = false;
      }
    } else if (ch === '\'' || ch === '"') {
      quote = ch;
      inToken = true;
    } else if (ch === '\\' && platform !== 'win32') {
      inToken = true;
      if (i + 1 < trimmed.length) {
        current += trimmed[i + 1];
        i += 1;
      } else {
        current += ch;
      }
    } else {
      inToken = true;
      current += ch;
    }
  }

  if (quote !== null) {
    throw new Error('Invalid custom CLI command: unclosed quote');
  }

  if (inToken) {
    tokens.push(current);
  }

  if (tokens.length === 0) {
    throw new Error('Custom CLI command is empty');
  }

  return { executable: tokens[0], inlineArgs: tokens.slice(1) };
}

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

    const { executable, inlineArgs } = parseCustomCommand(this.config.command);
    const rawArgs = [...inlineArgs, ...(this.config.args || [])];
    const usesInputPlaceholder = rawArgs.some(
      (arg) => typeof arg === 'string' && arg.includes('{{input}}')
    );
    const args = rawArgs.map((arg) =>
      typeof arg === 'string' && arg.includes('{{input}}')
        ? arg.replaceAll('{{input}}', fullContext)
        : String(arg)
    );

    const env = getEnhancedEnv();
    if (this.config.apiKeySecretId && this.secrets[this.config.apiKeySecretId]) {
      const envVarName = assertSafeApiKeyEnvVar(this.config.apiKeyEnvVar || 'API_KEY');
      env[envVarName] = this.secrets[this.config.apiKeySecretId];
    }

    const detected = await findExecutable(executable);
    const resolvedExecutable = detected?.path || executable;
    const command = this.config.command;

    return new Promise((resolve, reject) => {
      try {
        const spawnOptions = { env, signal };
        if (this.projectPath) {
          spawnOptions.cwd = this.projectPath;
        }
        const child = spawnCli(spawn, resolvedExecutable, args, spawnOptions);
        let stdout = '';
        let stderr = '';
        let buffer = '';
        let rawAccumulator = '';
        let jsonStreamDetected = false;
        let streamingStarted = false;

        const cleanChunk = (text) => {
          return text
            .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
            .replace(/\[\d+m/g, '');
        };

        const stripEchoedPrompt = (text) => {
            // Find the last [User] block in the echoed text (since history might have multiple, we want the last one)
            const usrIdx = text.lastIndexOf('[User]');
            if (usrIdx !== -1) {
              const nextBlock = text.indexOf('\n\n', usrIdx);
              if (nextBlock !== -1) {
                  return text.substring(nextBlock).trimStart();
              }
              return text.substring(usrIdx + 6).trimStart();
            }
            const sysIdx = text.indexOf('[System]');
            if (sysIdx !== -1) {
                return text.substring(0, sysIdx);
            }
            return text;
        };

        child.on('error', (err) => {
          if (signal?.aborted) return;
          reject(new Error(`Failed to start custom CLI "${this.config.name}": ${err.message}. (Command: ${command})`));
        });

        if (child.stdin) {
          child.stdin.on('error', () => {});
          if (!usesInputPlaceholder) {
            child.stdin.write(fullContext);
          }
          child.stdin.end();
        }

        child.stdout?.on('data', (data) => {
          const rawStr = data.toString();
          rawAccumulator += rawStr;
          buffer += cleanChunk(rawStr);

          // 1. JSONL STREAM DETECTION
          // We try to parse lines dynamically. If we find a valid JSON object with content, we lock into JSON mode.
          if (!jsonStreamDetected) {
             const lines = rawAccumulator.split('\n');
             for (const line of lines) {
                if (!line.trim()) continue;
                try {
                   const parsed = JSON.parse(line);
                   const text = parsed.content || parsed.text || parsed.message || parsed.response || parsed.delta || '';
                   if (text) {
                      jsonStreamDetected = true;
                      streamingStarted = true;
                   }
                } catch (e) {}
             }
             if (jsonStreamDetected) {
                // Keep only the incomplete line for future chunks
                rawAccumulator = lines[lines.length - 1]; 
             }
          }

          // 2. PROCESS CHUNK
          if (jsonStreamDetected) {
            const lines = rawAccumulator.split('\n');
            rawAccumulator = lines.pop() || '';
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const parsed = JSON.parse(line);
                const text = parsed.content || parsed.text || parsed.message || parsed.response || parsed.delta || '';
                if (text) {
                  stdout += text;
                  if (onDelta) onDelta(text);
                }
              } catch (e) {}
            }
          } else {
            // Text Mode (Fallback)
            if (streamingStarted) {
              const chunk = cleanChunk(rawStr);
              stdout += chunk;
              if (onDelta) onDelta(chunk);
              return;
            }

            // Look for agent turn markers
            const modelMarker = buffer.match(/──────────\s+(Assistant|Model|Agent|AI|System|Antigravity)[^\n]*\n/i);
            if (modelMarker) {
              streamingStarted = true;
              let startIdx = modelMarker.index + modelMarker[0].length;
              const nextLineEnd = buffer.indexOf('\n', startIdx);
              if (nextLineEnd !== -1) {
                const nextLine = buffer.substring(startIdx, nextLineEnd);
                if (nextLine.match(/^\(\d+\)\s+\d{4}-\d{2}-\d{2}/)) {
                  startIdx = nextLineEnd + 1;
                }
              }
              const validContent = buffer.substring(startIdx).replace(/^\s+/, '');
              stdout += validContent;
              if (onDelta && validContent) onDelta(validContent);
            } else if (buffer.length > 2000) {
              // Forced flush if buffer gets too large without finding a marker
              streamingStarted = true;
              const safeContent = stripEchoedPrompt(buffer);
              stdout += safeContent;
              if (onDelta && safeContent) onDelta(safeContent);
            }
          }
        });

        child.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        child.on('close', (code) => {
          if (!streamingStarted && !jsonStreamDetected) {
            const safeContent = stripEchoedPrompt(buffer);
            stdout += safeContent;
          }
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

  isCloudProvider() {
    return isCloudCustomCli(this.config);
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
