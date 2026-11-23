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

/**
 * Extract a model identifier from CLI arguments (`--model <id>`, `-m <id>`, `--model=<id>`, `-m=<id>`).
 *
 * @param {unknown[]} args
 * @returns {string|null}
 */
export function extractModelFromArgs(args) {
  if (!Array.isArray(args)) return null;
  for (let i = 0; i < args.length; i++) {
    const arg = typeof args[i] === 'string' ? args[i].trim() : String(args[i] ?? '').trim();
    if (!arg) continue;
    if (arg === '--model' || arg === '-m') {
      const next = i + 1 < args.length ? String(args[i + 1] ?? '').trim() : '';
      if (next && !next.startsWith('-') && next !== '{{input}}') {
        return next;
      }
      continue;
    }
    if (arg.startsWith('--model=') || arg.startsWith('-m=')) {
      const eqIdx = arg.indexOf('=');
      const val = arg.slice(eqIdx + 1).trim();
      if (val && val !== '{{input}}') {
        return val;
      }
    }
  }
  return null;
}

/**
 * Extract assistant text delta/content from a parsed JSONL stream object.
 *
 * @param {unknown} parsed
 * @returns {string}
 */
export function extractTextFromJsonLine(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return '';
  }

  const eventType = typeof parsed.type === 'string' ? parsed.type.trim().toLowerCase() : '';
  const role = typeof parsed.role === 'string'
    ? parsed.role.trim().toLowerCase()
    : typeof parsed.message?.role === 'string'
      ? parsed.message.role.trim().toLowerCase()
      : '';

  if (
    role === 'user' ||
    role === 'system' ||
    role === 'tool' ||
    eventType === 'user' ||
    eventType === 'system' ||
    eventType === 'init' ||
    eventType === 'input' ||
    eventType === 'prompt' ||
    eventType === 'tool_use' ||
    eventType === 'tool_result'
  ) {
    return '';
  }

  if (typeof parsed.content === 'string' && parsed.content) return parsed.content;
  if (typeof parsed.text === 'string' && parsed.text) return parsed.text;
  if (typeof parsed.response === 'string' && parsed.response) return parsed.response;
  if (typeof parsed.delta === 'string' && parsed.delta) return parsed.delta;
  if (typeof parsed.delta?.text === 'string' && parsed.delta.text) return parsed.delta.text;
  if (typeof parsed.choices?.[0]?.delta?.content === 'string' && parsed.choices[0].delta.content) {
    return parsed.choices[0].delta.content;
  }
  if (parsed.message !== undefined && parsed.message !== null) {
    if (typeof parsed.message === 'string' && parsed.message) return parsed.message;
    if (typeof parsed.message?.content === 'string' && parsed.message.content) return parsed.message.content;
    if (Array.isArray(parsed.message?.content)) {
      const combined = parsed.message.content
        .map((block) => {
          if (typeof block === 'string') return block;
          if (block?.type === 'text' && typeof block?.text === 'string') return block.text;
          return '';
        })
        .join('');
      if (combined) return combined;
    }
  }
  return '';
}

const KNOWN_JSON_STREAM_EVENT_TYPES = new Set([
  'init',
  'system',
  'user',
  'assistant',
  'message',
  'result',
  'error',
  'done',
  'complete',
  'input',
  'prompt',
  'tool_use',
  'tool_result',
  'tool_call',
  'content_block_start',
  'content_block_delta',
  'content_block_stop',
  'message_start',
  'message_delta',
  'message_stop',
  'delta',
  'text',
  'thinking',
  'reasoning',
  'response.created',
  'response.completed',
  'response.output_text.delta',
  'item.started',
  'item.completed',
  'turn.started',
  'turn.completed',
  'thread.started',
]);

const KNOWN_JSON_STREAM_ROLES = new Set([
  'assistant',
  'user',
  'system',
  'tool',
  'model',
  'developer',
]);

/**
 * Determine whether a parsed JSONL line represents a structured CLI stream event.
 * Prevents large non-assistant events (e.g., `init` or echoed `role: "user"` prompts)
 * from falling back to raw text mode before assistant deltas arrive, while ignoring
 * unrelated JSON objects (e.g., `{"type":"startup"}`) followed by plain text.
 *
 * @param {unknown} parsed
 * @returns {boolean}
 */
export function isJsonStreamEvent(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return false;
  }
  if (extractTextFromJsonLine(parsed)) return true;

  const eventType = typeof parsed.type === 'string' ? parsed.type.trim().toLowerCase() : '';
  if (eventType && KNOWN_JSON_STREAM_EVENT_TYPES.has(eventType)) return true;

  const role = typeof parsed.role === 'string' ? parsed.role.trim().toLowerCase() : '';
  if (role && KNOWN_JSON_STREAM_ROLES.has(role)) return true;

  if (parsed.message && typeof parsed.message === 'object' && !Array.isArray(parsed.message)) {
    const nestedRole = typeof parsed.message.role === 'string' ? parsed.message.role.trim().toLowerCase() : '';
    if (
      (nestedRole && KNOWN_JSON_STREAM_ROLES.has(nestedRole)) ||
      'content' in parsed.message ||
      (parsed.message.usage && typeof parsed.message.usage === 'object')
    ) {
      return true;
    }
  }

  if (parsed.usage && typeof parsed.usage === 'object') {
    if (
      extractTokensFromObject(parsed.usage) !== null ||
      parsed.total_cost_usd !== undefined ||
      parsed.usage.cost_usd !== undefined ||
      parsed.usage.total_cost_usd !== undefined
    ) {
      return true;
    }
  }

  if (parsed.stats && typeof parsed.stats === 'object') {
    if (
      extractTokensFromObject(parsed.stats) !== null ||
      (parsed.stats.models && typeof parsed.stats.models === 'object')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Check whether the trailing incomplete line of accumulated stdout looks like a candidate JSON object.
 * Used to avoid prematurely flushing an incomplete large `init` JSONL record into plain-text fallback
 * before its terminating newline arrives.
 *
 * @param {string} rawText
 * @returns {boolean}
 */
export function isIncompleteCandidateJsonObject(rawText) {
  if (typeof rawText !== 'string' || !rawText) return false;
  const lastNewline = rawText.lastIndexOf('\n');
  const trailing = lastNewline === -1 ? rawText : rawText.slice(lastNewline + 1);
  const trimmed = trailing.trimStart();
  if (!trimmed.startsWith('{')) return false;
  const afterBrace = trimmed.slice(1).trimStart();
  if (!afterBrace) return true;
  return afterBrace.startsWith('"') || afterBrace.startsWith('}');
}

function firstPositiveNumber(candidates) {
  for (const val of candidates) {
    if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
      return val;
    }
  }
  return null;
}

function extractTokensFromObject(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const tokensIn = firstPositiveNumber([
    obj.input_tokens,
    obj.inputTokens,
    obj.prompt_tokens,
    obj.promptTokens,
    obj.tokens_in,
    obj.prompt,
  ]);
  const tokensOut = firstPositiveNumber([
    obj.output_tokens,
    obj.outputTokens,
    obj.completion_tokens,
    obj.completionTokens,
    obj.tokens_out,
    obj.candidates,
  ]);
  const tokensCacheRead = firstPositiveNumber([
    obj.cache_read_input_tokens,
    obj.cache_read_tokens,
    obj.cacheReadTokens,
    obj.prompt_tokens_details?.cached_tokens,
    obj.cached_tokens,
    obj.cached,
  ]);
  const tokensCacheWrite = firstPositiveNumber([
    obj.cache_creation_input_tokens,
    obj.cache_creation_tokens,
    obj.cacheWriteTokens,
    obj.cache_write_tokens,
  ]);
  const tokensReasoning = firstPositiveNumber([
    obj.reasoning_tokens,
    obj.reasoningTokens,
    obj.completion_tokens_details?.reasoning_tokens,
    obj.thoughts,
  ]);
  if (
    tokensIn === null &&
    tokensOut === null &&
    tokensCacheRead === null &&
    tokensCacheWrite === null &&
    tokensReasoning === null
  ) {
    return null;
  }
  return { tokensIn, tokensOut, tokensCacheRead, tokensCacheWrite, tokensReasoning };
}

/**
 * Extract structured model, token usage, and USD cost metadata from a parsed JSONL stream event.
 * Avoids double-counting by replacing authoritatively on final result objects and taking max otherwise.
 *
 * @param {unknown} parsed
 * @param {{ model_used: string, tokens_in: number, tokens_out: number, tokens_cache_read: number, tokens_cache_write: number, tokens_reasoning: number, cost_usd: number, hasMetadata: boolean }} acc
 */
export function extractUsageMetadataFromJson(parsed, acc) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !acc) {
    return;
  }

  const isAuthoritative = parsed.type === 'result' || parsed.total_cost_usd !== undefined;
  const applyMetric = (field, val) => {
    if (val === null || val === undefined || !Number.isFinite(val) || val <= 0) return;
    acc[field] = isAuthoritative ? val : Math.max(acc[field] || 0, val);
    acc.hasMetadata = true;
  };

  const modelCandidates = [
    parsed.model,
    parsed.message?.model,
    parsed.response?.model,
    parsed.metadata?.model,
    parsed.model_used,
    parsed.modelUsed,
    parsed.stats?.models && typeof parsed.stats.models === 'object' ? Object.keys(parsed.stats.models)[0] : null,
  ];
  for (const candidate of modelCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      acc.model_used = candidate.trim();
      acc.hasMetadata = true;
      break;
    }
  }

  const cost = firstPositiveNumber([
    parsed.total_cost_usd,
    parsed.cost_usd,
    parsed.costUsd,
    parsed.totalCostUsd,
    parsed.usage?.total_cost_usd,
    parsed.usage?.cost_usd,
    parsed.usage?.costUsd,
    parsed.usage?.cost,
    parsed.stats?.cost_usd,
  ]);
  if (cost !== null) {
    applyMetric('cost_usd', cost);
  }

  const directSources = [
    parsed.usage,
    parsed.message?.usage,
    parsed.response?.usage,
    parsed.stats,
    parsed.metadata,
    parsed,
  ];

  for (const source of directSources) {
    const extracted = extractTokensFromObject(source);
    if (!extracted) continue;
    applyMetric('tokens_in', extracted.tokensIn);
    applyMetric('tokens_out', extracted.tokensOut);
    applyMetric('tokens_cache_read', extracted.tokensCacheRead);
    applyMetric('tokens_cache_write', extracted.tokensCacheWrite);
    applyMetric('tokens_reasoning', extracted.tokensReasoning);
  }

  if (parsed.stats?.models && typeof parsed.stats.models === 'object' && !Array.isArray(parsed.stats.models)) {
    let sumIn = 0;
    let sumOut = 0;
    let sumCacheRead = 0;
    let sumCacheWrite = 0;
    let sumReasoning = 0;
    for (const modelEntry of Object.values(parsed.stats.models)) {
      if (!modelEntry || typeof modelEntry !== 'object') continue;
      for (const candidateObj of [modelEntry.tokens, modelEntry]) {
        const extracted = extractTokensFromObject(candidateObj);
        if (!extracted) continue;
        if (extracted.tokensIn) sumIn += extracted.tokensIn;
        if (extracted.tokensOut) sumOut += extracted.tokensOut;
        if (extracted.tokensCacheRead) sumCacheRead += extracted.tokensCacheRead;
        if (extracted.tokensCacheWrite) sumCacheWrite += extracted.tokensCacheWrite;
        if (extracted.tokensReasoning) sumReasoning += extracted.tokensReasoning;
        break;
      }
    }
    applyMetric('tokens_in', sumIn);
    applyMetric('tokens_out', sumOut);
    applyMetric('tokens_cache_read', sumCacheRead);
    applyMetric('tokens_cache_write', sumCacheWrite);
    applyMetric('tokens_reasoning', sumReasoning);
  }
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
    const tempImagePaths = (request.messages || []).flatMap((m) =>
      Array.isArray(m?.tempImagePaths) ? m.tempImagePaths.map((img) => img?.filePath).filter(Boolean) : []
    );
    const usesInputPlaceholder = rawArgs.some(
      (arg) => typeof arg === 'string' && arg.includes('{{input}}')
    );
    const args = [];
    for (const rawArg of rawArgs) {
      if (rawArg === '{{images}}') {
        for (const imgPath of tempImagePaths) {
          args.push(imgPath);
        }
        continue;
      }
      let nextArg = String(rawArg);
      if (nextArg.includes('{{input}}')) {
        nextArg = nextArg.replaceAll('{{input}}', fullContext);
      }
      if (nextArg.includes('{{images}}')) {
        nextArg = nextArg.replaceAll('{{images}}', tempImagePaths.join(' '));
      }
      args.push(nextArg);
    }

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
        const explicitJsonlMode =
          this.config?.jsonStream === true ||
          this.config?.outputFormat === 'jsonl' ||
          this.config?.outputFormat === 'stream-json';
        let jsonStreamDetected = explicitJsonlMode;
        let streamingStarted = explicitJsonlMode;
        const jsonMeta = {
          model_used: '',
          tokens_in: 0,
          tokens_out: 0,
          tokens_cache_read: 0,
          tokens_cache_write: 0,
          tokens_reasoning: 0,
          cost_usd: 0,
          hasMetadata: false,
        };

        const processJsonLine = (trimmedLine) => {
          if (!trimmedLine) return false;
          try {
            const parsed = JSON.parse(trimmedLine);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
              return false;
            }
            extractUsageMetadataFromJson(parsed, jsonMeta);
            const text = extractTextFromJsonLine(parsed);
            if (text) {
              stdout += text;
              if (onDelta) onDelta(text);
            }
            return true;
          } catch {
            return false;
          }
        };

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
          child.stdin.on('error', () => { });
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
          // We inspect complete lines first. If any complete line is a JSON object with assistant text,
          // we lock into JSONL mode while keeping all complete lines so the triggering line is not lost.
          if (!jsonStreamDetected) {
            const lines = rawAccumulator.split('\n');
            const completeLines = lines.slice(0, -1);
            for (const line of completeLines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              try {
                const parsed = JSON.parse(trimmed);
                if (isJsonStreamEvent(parsed)) {
                  jsonStreamDetected = true;
                  streamingStarted = true;
                  break;
                }
              } catch { }
            }
          }

          // 2. PROCESS CHUNK
          if (jsonStreamDetected) {
            const lines = rawAccumulator.split('\n');
            rawAccumulator = lines.pop() || '';
            for (const line of lines) {
              processJsonLine(line.trim());
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
            } else {
              const flushThreshold = buffer.includes('[System]') ? Math.max(2000, fullContext.length + 2000) : 2000;
              const maxCandidateJsonBuffer = Math.max(512 * 1024, fullContext.length * 2 + 64 * 1024);
              const deferForJsonCandidate =
                isIncompleteCandidateJsonObject(rawAccumulator) &&
                rawAccumulator.length <= maxCandidateJsonBuffer;
              if (!deferForJsonCandidate && buffer.length > flushThreshold) {
                // Forced flush if buffer gets too large without finding a marker
                streamingStarted = true;
                const safeContent = stripEchoedPrompt(buffer);
                stdout += safeContent;
                if (onDelta && safeContent) onDelta(safeContent);
              }
            }
          }
        });

        child.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        child.on('close', (code) => {
          if (jsonStreamDetected) {
            if (rawAccumulator.trim()) {
              processJsonLine(rawAccumulator.trim());
              rawAccumulator = '';
            }
          } else if (rawAccumulator.trim()) {
            const remainingLines = rawAccumulator.split('\n').map((l) => l.trim()).filter(Boolean);
            const hasStreamTextJson = remainingLines.some((line) => {
              try {
                const parsed = JSON.parse(line);
                return isJsonStreamEvent(parsed);
              } catch {
                return false;
              }
            });
            if (hasStreamTextJson) {
              jsonStreamDetected = true;
              streamingStarted = true;
              for (const line of remainingLines) {
                processJsonLine(line);
              }
              rawAccumulator = '';
            }
          }

          if (!streamingStarted && !jsonStreamDetected) {
            const safeContent = stripEchoedPrompt(buffer);
            stdout += safeContent;
          }

          const finalMetadata = jsonMeta.hasMetadata
            ? {
              model_used: jsonMeta.model_used,
              tokens_in: jsonMeta.tokens_in,
              tokens_out: jsonMeta.tokens_out,
              tokens_cache_read: jsonMeta.tokens_cache_read,
              tokens_cache_write: jsonMeta.tokens_cache_write,
              tokens_reasoning: jsonMeta.tokens_reasoning,
              cost_usd: jsonMeta.cost_usd,
            }
            : null;

          if (signal?.aborted) {
            resolve({ content: stdout.trim() + '\n\n_Stopped._', tool_calls: null, metadata: finalMetadata });
            return;
          }
          if (code !== 0) {
            reject(new Error(`Custom CLI ${this.config.name} exited with code ${code}: ${stderr}`));
          } else {
            resolve({ content: stdout.trim(), tool_calls: null, metadata: finalMetadata });
          }
        });
      } catch (err) {
        reject(new Error(`Unexpected error spawning ${this.config.name}: ${err.message}`));
      }
    });
  }

  async resolveModel() {
    const configured = this.config?.model || this.config?.modelAlias || this.config?.model_alias;
    if (typeof configured === 'string' && configured.trim()) {
      return configured.trim();
    }
    try {
      const { inlineArgs } = parseCustomCommand(this.config?.command || '');
      const fromArgs = extractModelFromArgs([...inlineArgs, ...(this.config?.args || [])]);
      if (fromArgs) return fromArgs;
    } catch {
      // Ignore empty/invalid command string
    }
    const fallbackName = String(this.config?.name || this.config?.id || '').trim();
    if (fallbackName) return fallbackName;
    return this.isCloudProvider() ? 'custom-cloud-model' : 'custom-local-model';
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
