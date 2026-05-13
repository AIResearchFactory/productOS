import { AIProvider } from './base.mjs';

export class OllamaProvider extends AIProvider {
  constructor(config) {
    super();
    this.config = config;
  }

  async chat(request) {
    const { onDelta, signal } = request;
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
      if (models.length > 0) {
        model = models[0];
      } else {
        model = 'llama3';
      }
    }

    const body = {
      model,
      messages,
      stream: !!onDelta,
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
      signal
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Ollama API error (${res.status}): ${text}`);
    }

    if (onDelta) {
      if (!res.body) {
        throw new Error('Ollama provider returned empty response body');
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let stdout = '';
      try {
        let buffer = '';
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
                const chunk = data.message.content;
                stdout += chunk;
                onDelta(chunk);
              }
              if (data.done) break;
            } catch (e) {
              // Ignore partial JSON
            }
          }
        }
        if (buffer.trim()) {
          try {
            const data = JSON.parse(buffer);
            if (data.message?.content) {
              const chunk = data.message.content;
              stdout += chunk;
              onDelta(chunk);
            }
          } catch (e) {
            // Ignore partial JSON
          }
        }
        return { content: stdout.trim(), tool_calls: null, metadata: null };
      } finally {
        reader.releaseLock();
      }
    } else {
      const data = await res.json();
      return {
        content: data.message?.content || '',
        tool_calls: null,
        metadata: null,
      };
    }
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
      if (models.length > 0) {
        model = models[0];
      } else {
        model = 'llama3';
      }
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

    if (!res.body) {
      throw new Error('Ollama provider returned empty response body');
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
        if (buffer.trim()) {
          try {
            const data = JSON.parse(buffer);
            if (data.message?.content) {
              yield data.message.content;
            }
          } catch (e) {
            // Ignore partial JSON
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
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
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
        const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) return false;
        
        const data = await res.json();
        const models = (data.models || []).map(m => m.name);
        
        let modelToCheck = this.config?.model;
        if (!modelToCheck) {
            // If no model configured, we just need at least one model to be available
            return models.length > 0;
        }
        
        // Check if the configured model exists (exact match or without :latest)
        return models.includes(modelToCheck) || 
               models.includes(`${modelToCheck}:latest`) ||
               models.some(m => m.startsWith(`${modelToCheck}:`));
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
