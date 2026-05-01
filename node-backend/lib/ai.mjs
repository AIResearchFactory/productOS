import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';

export class AIProvider {
  async chat(request) {
    throw new Error('chat not implemented');
  }

  async chatStream(request) {
    throw new Error('chatStream not implemented');
  }

  async resolveModel() {
    return '';
  }

  async listModels() {
    return [];
  }

  supportsMcp() {
    return false;
  }

  providerType() {
    throw new Error('providerType not implemented');
  }

  isAvailable() {
    return true;
  }

  async checkAuthentication() {
    return true;
  }

  async checkHealth() {
    if (this.isAvailable()) {
      const authenticated = await this.checkAuthentication().catch(() => false);
      if (authenticated) {
        return { status: 'healthy' };
      } else {
        return { status: 'unhealthy', message: 'Authentication missing' };
      }
    } else {
      return { status: 'unhealthy', message: 'Provider not detected' };
    }
  }

  metadata() {
    return {
      id: 'unknown',
      name: 'Unknown Provider',
      description: '',
      capabilities: [],
      models: [],
    };
  }

  getSetupGuidance() {
    return [];
  }
}

export class OllamaProvider extends AIProvider {
  constructor(config) {
    super();
    this.config = config;
  }

  async chat(request) {
    const url = `${this.config.api_url.replace(/\/$/, '')}/api/chat`;
    const messages = [];
    if (request.system_prompt) {
      messages.push({ role: 'system', content: request.system_prompt });
    }
    messages.push(...request.messages.map(m => ({ role: m.role, content: m.content })));

    const body = {
      model: this.config.model,
      messages,
      stream: false,
      options: {
        temperature: request.options?.temperature,
        num_predict: request.options?.max_tokens,
        top_p: request.options?.top_p,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Ollama API error (${res.status}): ${text}`);
    }

    const data = await res.json();
    return {
      content: data.message?.content || '',
      tool_calls: null,
      metadata: null,
    };
  }

  async chatStream(request) {
    const url = `${this.config.api_url.replace(/\/$/, '')}/api/chat`;
    const messages = [];
    if (request.system_prompt) {
      messages.push({ role: 'system', content: request.system_prompt });
    }
    messages.push(...request.messages.map(m => ({ role: m.role, content: m.content })));

    const body = {
      model: this.config.model,
      messages,
      stream: true,
      options: {
        temperature: request.options?.temperature,
        num_predict: request.options?.max_tokens,
        top_p: request.options?.top_p,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Ollama API error (${res.status}): ${text}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    return (async function* () {
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const data = JSON.parse(line);
              if (data.message?.content) {
                yield data.message.content;
              }
              if (data.done) return;
            } catch (e) {
              // Ignore partial JSON
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    })();
  }

  providerType() {
    return 'ollama';
  }

  metadata() {
    return {
      id: 'ollama',
      name: 'Ollama',
      description: 'Local Ollama server',
      capabilities: ['chat', 'stream'],
      models: [this.config.model],
    };
  }
}

export class HostedAPIProvider extends AIProvider {
  constructor(config) {
    super();
    this.config = config;
  }

  async chat(request) {
    // Basic implementation for Hosted API (OpenAI-compatible)
    const url = `${this.config.api_url.replace(/\/$/, '')}/chat/completions`;
    const messages = [];
    if (request.system_prompt) {
      messages.push({ role: 'system', content: request.system_prompt });
    }
    messages.push(...request.messages.map(m => ({ role: m.role, content: m.content })));

    const body = {
      model: this.config.model,
      messages,
      stream: false,
      temperature: request.options?.temperature,
      max_tokens: request.options?.max_tokens,
    };

    const headers = { 'Content-Type': 'application/json' };
    if (this.config.api_key) {
      headers['Authorization'] = `Bearer ${this.config.api_key}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Hosted API error (${res.status}): ${text}`);
    }

    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      tool_calls: null,
      metadata: {
        model_used: data.model || this.config.model,
        tokens_in: data.usage?.prompt_tokens || 0,
        tokens_out: data.usage?.completion_tokens || 0,
        cost_usd: 0, // Need pricing lookup
      },
    };
  }

  providerType() {
    return 'hostedApi';
  }

  metadata() {
    return {
      id: 'hosted',
      name: 'Hosted API',
      description: 'Cloud LLM Provider (OpenAI Compatible)',
      capabilities: ['chat', 'stream'],
      models: [this.config.model],
    };
  }
}

export class GeminiCliProvider extends AIProvider {
  constructor(config) {
    super();
    this.config = config;
  }

  async chat(request) {
    // Use 'gemini chat' command
    const args = ['chat', '--model', this.config.model_alias || 'pro'];
    if (request.system_prompt) {
      // In Gemini CLI, system prompt might be passed via --system or as the first message
      // Depending on the CLI version. Assuming it's passed as part of the messages for now.
    }

    const input = request.messages[request.messages.length - 1].content;
    
    return new Promise((resolve, reject) => {
      const child = spawn(this.config.command || 'gemini', args);
      let stdout = '';
      let stderr = '';

      child.stdin.write(input);
      child.stdin.end();

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Gemini CLI exited with code ${code}: ${stderr}`));
        } else {
          resolve({
            content: stdout.trim(),
            tool_calls: null,
            metadata: null,
          });
        }
      });
    });
  }

  providerType() {
    return 'geminiCli';
  }

  metadata() {
    return {
      id: 'gemini_cli',
      name: 'Gemini CLI',
      description: 'Google Gemini via CLI',
      capabilities: ['chat'],
      models: [this.config.model_alias || 'pro'],
    };
  }
}

export class AIService {
  static async createProvider(providerType, settings) {
    switch (providerType) {
      case 'ollama':
        return new OllamaProvider(settings.ollama);
      case 'hostedApi':
        return new HostedAPIProvider(settings.hosted);
      case 'geminiCli':
        return new GeminiCliProvider(settings.gemini_cli);
      default:
        // Fallback to Hosted API if unknown
        return new HostedAPIProvider(settings.hosted);
    }
  }
}
