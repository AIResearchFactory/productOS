import { AIProvider } from './base.mjs';

export class OllamaProvider extends AIProvider {
  constructor(config) {
    super();
    this.config = config;
  }

  async chat(request) {
    const apiUrl = this.config?.api_url || 'http://localhost:11434';
    const url = `${apiUrl.replace(/\/$/, '')}/api/chat`;
    const messages = [];
    if (request.system_prompt) {
      messages.push({ role: 'system', content: request.system_prompt });
    }
    messages.push(...request.messages.map(m => ({ role: m.role, content: m.content })));

    let model = this.config?.model;
    if (!model) {
      const models = await this.listModels();
      model = models[0] || 'llama3';
    }

    const body = {
      model,
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
    const apiUrl = this.config?.api_url || 'http://localhost:11434';
    const url = `${apiUrl.replace(/\/$/, '')}/api/chat`;
    const messages = [];
    if (request.system_prompt) {
      messages.push({ role: 'system', content: request.system_prompt });
    }
    messages.push(...request.messages.map(m => ({ role: m.role, content: m.content })));

    let model = this.config?.model;
    if (!model) {
      const models = await this.listModels();
      model = models[0] || 'llama3';
    }

    const body = {
      model,
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

  async listModels() {
    try {
      const apiUrl = this.config?.api_url || 'http://localhost:11434';
      const url = `${apiUrl.replace(/\/$/, '')}/api/tags`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.models || []).map(m => m.name);
    } catch {
      return [];
    }
  }

  async checkAuthentication() {
    try {
        const apiUrl = this.config?.api_url || 'http://localhost:11434';
        const url = `${apiUrl.replace(/\/$/, '')}/api/tags`;
        const res = await fetch(url);
        return res.ok;
    } catch {
        return false;
    }
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
      models: [this.config?.model].filter(Boolean),
    };
  }
}
