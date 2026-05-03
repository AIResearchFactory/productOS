import { spawn } from 'child_process';
import { parseCommandString } from '../utils/process.js';
import { cancellationManager } from './cancellation.js';
import { getSecret } from './secrets.js';
import { loadGlobalSettings } from './settings.js';
import { commandExists } from '../utils/process.js';
import { resolveProjectPath } from './project.js';

/**
 * Port of Rust AIProvider trait + ai_service.rs + all providers.
 * Unified CLI-based AI provider execution engine.
 */

// ============= Provider Base =============

function formatPrompt(request) {
  let prompt = '';
  if (request.systemPrompt) {
    prompt += `System Instruction:\n${request.systemPrompt}\n\n`;
  }
  for (const msg of (request.messages || [])) {
    const role = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Model' : msg.role;
    prompt += `${role}: ${msg.content}\n`;
  }
  return prompt;
}

async function runCliProvider(command, args, env, projectPath, cancellationId) {
  return new Promise((resolve, reject) => {
    const opts = { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] };
    if (projectPath) opts.cwd = projectPath;

    const child = spawn(command, args, opts);
    cancellationManager.registerProcess(cancellationId || 'chat', child);

    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });

    child.on('close', (code) => {
      cancellationManager.removeProcess(cancellationId || 'chat');
      if (code === 0) {
        resolve({ content: stdout.trim(), tool_calls: null, metadata: null });
      } else {
        reject(new Error(stderr.trim() || `CLI exited with code ${code}`));
      }
    });

    child.on('error', (err) => {
      cancellationManager.removeProcess(cancellationId || 'chat');
      reject(err);
    });
  });
}

function streamCliProvider(command, args, env, projectPath, cancellationId) {
  const opts = { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] };
  if (projectPath) opts.cwd = projectPath;

  const child = spawn(command, args, opts);
  cancellationManager.registerProcess(cancellationId || 'chat_stream', child);

  child.on('close', () => {
    cancellationManager.removeProcess(cancellationId || 'chat_stream');
  });

  return child.stdout;
}

// ============= Individual Providers =============

const providers = {
  geminiCli: {
    name: 'Gemini CLI',
    async chat(request, config) {
      const prompt = formatPrompt(request);
      const apiKey = await getSecret(config.apiKeySecretId || 'GEMINI_API_KEY');
      const envVar = config.apiKeyEnvVar || 'GEMINI_API_KEY';
      const env = {};
      if (apiKey) env[envVar] = apiKey;

      const parsed = parseCommandString(config.command || 'gemini');
      const args = [...parsed.args];
      const model = config.modelAlias || 'auto';
      if (model !== 'auto') { args.push('--model', model); }
      args.push('--prompt', prompt);

      return runCliProvider(parsed.program, args, env, request.projectPath, 'chat_gemini');
    },
    chatStream(request, config) {
      const prompt = formatPrompt(request);
      const env = {};
      const parsed = parseCommandString(config.command || 'gemini');
      const args = [...parsed.args];
      const model = config.modelAlias || 'auto';
      if (model !== 'auto') { args.push('--model', model); }
      args.push('-o', 'stream-json', '--prompt', prompt);
      env.FORCE_COLOR = '1'; env.PYTHONUNBUFFERED = '1';
      return streamCliProvider(parsed.program, args, env, request.projectPath, 'chat_gemini_stream');
    },
    isAvailable(config) {
      const cmd = (config.command || 'gemini').split(/\s+/)[0];
      return commandExists(cmd);
    },
    metadata(config) {
      return { id: 'gemini-cli', name: 'Gemini CLI', capabilities: ['chat', 'stream', 'mcp'], models: [config.modelAlias || 'auto'] };
    }
  },

  claudeCode: {
    name: 'Claude Code',
    async chat(request, _config) {
      const prompt = formatPrompt(request);
      const args = ['-p', prompt, '--output-format', 'text'];
      return runCliProvider('claude', args, {}, request.projectPath, 'chat_claude');
    },
    chatStream(request, _config) {
      const prompt = formatPrompt(request);
      const args = ['-p', prompt, '--output-format', 'stream-json'];
      return streamCliProvider('claude', args, {}, request.projectPath, 'chat_claude_stream');
    },
    isAvailable() { return commandExists('claude'); },
    metadata() { return { id: 'claude-code', name: 'Claude Code', capabilities: ['chat', 'stream', 'mcp'], models: ['claude'] }; }
  },

  openAiCli: {
    name: 'OpenAI CLI (Codex)',
    async chat(request, config) {
      const prompt = formatPrompt(request);
      const apiKey = await getSecret(config.apiKeySecretId || 'OPENAI_API_KEY');
      const envVar = config.apiKeyEnvVar || 'OPENAI_API_KEY';
      const env = {};
      if (apiKey) env[envVar] = apiKey;

      const parsed = parseCommandString(config.command || 'codex');
      const args = [...parsed.args, '-q', prompt];

      return runCliProvider(parsed.program, args, env, request.projectPath, 'chat_openai');
    },
    isAvailable(config) {
      const cmd = (config.command || 'codex').split(/\s+/)[0];
      return commandExists(cmd);
    },
    metadata(config) { return { id: 'openai-cli', name: 'OpenAI CLI', capabilities: ['chat'], models: [config.modelAlias || 'auto'] }; }
  },

  ollama: {
    name: 'Ollama',
    async chat(request, config) {
      const apiUrl = config.apiUrl || 'http://localhost:11434';
      const model = config.model || 'llama3';
      const messages = [];
      if (request.systemPrompt) messages.push({ role: 'system', content: request.systemPrompt });
      for (const m of (request.messages || [])) messages.push({ role: m.role, content: m.content });

      const resp = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, stream: false })
      });
      if (!resp.ok) throw new Error(`Ollama error: ${resp.statusText}`);
      const data = await resp.json();
      return { content: data.message?.content || '', tool_calls: null, metadata: null };
    },
    isAvailable(config) {
      const apiUrl = config.apiUrl || 'http://localhost:11434';
      try { commandExists('ollama'); return true; } catch { return false; }
    },
    metadata(config) { return { id: 'ollama', name: 'Ollama', capabilities: ['chat'], models: [config.model || 'llama3'] }; }
  },

  hostedApi: {
    name: 'Hosted API',
    async chat(request, config) {
      const apiKey = await getSecret(config.apiKeySecretId || 'ANTHROPIC_API_KEY');
      if (!apiKey) throw new Error('API key not configured for hosted provider');

      const prov = config.provider || 'anthropic';
      const model = config.model || 'claude-3-5-sonnet-20241022';
      const messages = [];
      for (const m of (request.messages || [])) messages.push({ role: m.role, content: m.content });

      let url, headers, body;
      if (prov === 'anthropic') {
        url = 'https://api.anthropic.com/v1/messages';
        headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
        body = { model, max_tokens: 4096, messages };
        if (request.systemPrompt) body.system = request.systemPrompt;
      } else {
        url = 'https://api.openai.com/v1/chat/completions';
        headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
        if (request.systemPrompt) messages.unshift({ role: 'system', content: request.systemPrompt });
        body = { model, messages };
      }

      const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!resp.ok) { const t = await resp.text(); throw new Error(`Hosted API error: ${t}`); }
      const data = await resp.json();

      let content;
      if (prov === 'anthropic') {
        content = data.content?.map(b => b.text || '').join('') || '';
      } else {
        content = data.choices?.[0]?.message?.content || '';
      }
      return { content, tool_calls: null, metadata: null };
    },
    isAvailable() { return true; },
    metadata(config) { return { id: 'hosted-api', name: 'Hosted API', capabilities: ['chat'], models: [config.model] }; }
  },

  liteLlm: {
    name: 'LiteLLM',
    async chat(request, config) {
      const baseUrl = config.baseUrl || 'http://localhost:4000';
      const apiKey = await getSecret(config.apiKeySecretId || 'LITELLM_API_KEY');
      const model = config.strategy?.defaultModel || 'gpt-4.1-mini';
      const messages = [];
      if (request.systemPrompt) messages.push({ role: 'system', content: request.systemPrompt });
      for (const m of (request.messages || [])) messages.push({ role: m.role, content: m.content });

      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST', headers, body: JSON.stringify({ model, messages })
      });
      if (!resp.ok) throw new Error(`LiteLLM error: ${resp.statusText}`);
      const data = await resp.json();
      return { content: data.choices?.[0]?.message?.content || '', tool_calls: null, metadata: null };
    },
    isAvailable(config) { return config.enabled !== false; },
    metadata(config) { return { id: 'litellm', name: 'LiteLLM', capabilities: ['chat'], models: [config.strategy?.defaultModel] }; }
  },

  customCli: {
    name: 'Custom CLI',
    async chat(request, config) {
      const prompt = formatPrompt(request);
      const parsed = parseCommandString(config.command || 'echo');
      const args = [...parsed.args, prompt];
      return runCliProvider(parsed.program, args, {}, request.projectPath, `chat_custom_${config.id}`);
    },
    isAvailable(config) {
      const cmd = (config.command || '').split(/\s+/)[0];
      return cmd ? commandExists(cmd) : false;
    },
    metadata(config) { return { id: config.id, name: config.name || config.id, capabilities: ['chat'], models: [] }; }
  }
};

// ============= AI Service =============

let activeProviderType = null;

export function getProvider(providerType, settings) {
  if (providerType?.startsWith?.('custom-') || providerType?.startsWith?.('Custom(')) {
    const customId = providerType.replace(/^Custom\(/, '').replace(/\)$/, '').replace(/^custom-/, '');
    const customConfig = settings.customClis?.find(c => c.id === `custom-${customId}` || c.id === customId);
    return { provider: providers.customCli, config: customConfig || {} };
  }

  const providerMap = {
    geminiCli: { provider: providers.geminiCli, config: settings.geminiCli || {} },
    claudeCode: { provider: providers.claudeCode, config: settings.claude || {} },
    openAiCli: { provider: providers.openAiCli, config: settings.openAiCli || {} },
    ollama: { provider: providers.ollama, config: settings.ollama || {} },
    hostedApi: { provider: providers.hostedApi, config: settings.hosted || {} },
    liteLlm: { provider: providers.liteLlm, config: settings.liteLlm || {} },
  };

  // Normalize camelCase/snake_case/etc
  const key = (providerType || '').replace(/[-_]/g, '').toLowerCase();
  for (const [k, v] of Object.entries(providerMap)) {
    if (k.toLowerCase() === key || k.replace(/[A-Z]/g, m => m.toLowerCase()) === key) return v;
  }

  return providerMap.geminiCli; // fallback
}

export async function chat(messages, systemPrompt, projectId) {
  const settings = loadGlobalSettings();
  const providerType = activeProviderType || settings.activeProvider || 'geminiCli';
  const { provider, config } = getProvider(providerType, settings);

  // CI mock response
  if (process.env.CI) {
    return { content: '{"workflow_name":"Mock","steps":[]}', tool_calls: null, metadata: null };
  }

  const projectPath = projectId ? (() => { try { return resolveProjectPath(projectId); } catch { return null; } })() : null;
  return provider.chat({ messages, systemPrompt, projectPath }, config);
}

export async function chatStream(messages, systemPrompt, projectId) {
  const settings = loadGlobalSettings();
  const providerType = activeProviderType || settings.activeProvider || 'geminiCli';
  const { provider, config } = getProvider(providerType, settings);

  if (!provider.chatStream) throw new Error('Streaming not supported by this provider');
  const projectPath = projectId ? (() => { try { return resolveProjectPath(projectId); } catch { return null; } })() : null;
  return provider.chatStream({ messages, systemPrompt, projectPath }, config);
}

export function switchProvider(providerType) {
  activeProviderType = providerType;
  // Persist to settings
  const settings = loadGlobalSettings();
  settings.activeProvider = providerType;
  const { saveGlobalSettings } = await_import('./settings.js');
}

// Lazy import helper (avoids circular deps)
function await_import(mod) {
  return import(mod);
}

export async function listAvailableProviders() {
  const settings = loadGlobalSettings();
  const available = [];

  const builtIn = ['geminiCli', 'claudeCode', 'ollama', 'liteLlm', 'openAiCli', 'hostedApi'];
  for (const type of builtIn) {
    const { provider, config } = getProvider(type, settings);
    try {
      if (provider.isAvailable(config)) available.push(type);
    } catch { /* skip */ }
  }

  for (const cli of (settings.customClis || [])) {
    const id = cli.id?.startsWith('custom-') ? cli.id : `custom-${cli.id}`;
    try {
      if (providers.customCli.isAvailable(cli)) available.push(id);
    } catch { /* skip */ }
  }

  return available;
}

export function getActiveProviderType() {
  const settings = loadGlobalSettings();
  return activeProviderType || settings.activeProvider || 'geminiCli';
}

export function getProviderMetadata(providerType) {
  const settings = loadGlobalSettings();
  const { provider, config } = getProvider(providerType, settings);
  return provider.metadata(config);
}
