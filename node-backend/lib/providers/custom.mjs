import { AIProvider, spawnCli, isCloudCustomCli } from './base.mjs';
import { spawn } from 'node:child_process';

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
        const spawnOptions = { env, shell: true, signal };
        if (this.projectPath) {
          spawnOptions.cwd = this.projectPath;
        }
        const child = spawnCli(spawn, command, args, spawnOptions);
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

        if (!this.config.args?.includes('{{input}}') && child.stdin) {
          child.stdin.write(fullContext);
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
