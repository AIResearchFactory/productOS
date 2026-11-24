import { AIProvider } from './base.mjs';

function formatOllamaMessages(request) {
  const messages = [];
  if (request.system_prompt) {
    messages.push({ role: 'system', content: request.system_prompt });
  }
  for (const m of request.messages || []) {
    const msg = { role: m.role, content: m.content };
    if (Array.isArray(m?.attachments) && m.attachments.length > 0) {
      msg.images = m.attachments
        .map((att) => att.base64 || String(att.dataUrl || '').replace(/^data:[^;]+;base64,/, ''))
        .filter(Boolean);
    }
    messages.push(msg);
  }
  return messages;
}

function buildOllamaError(status, text, model) {
  if (/vision|image|multimodal|does not support/i.test(text)) {
    return new Error(
      `Selected Ollama model (${model}) does not support image analysis. Switch to a vision-capable model or remove the attached image(s).`
    );
  }
  return new Error(`Ollama API error (${status}): ${text}`);
}

export class OllamaProvider extends AIProvider {
  constructor(config, secrets = {}, projectPath = null) {
    super();
    this.config = config;
    this.secrets = secrets;
    this.projectPath = projectPath;
  }

  usesTempFilesForImages() {
    return false;
  }

  async chat(request) {
    const { onDelta, signal } = request;
    const apiUrl = this.config?.api_url || 'http://localhost:11434';
    const url = `${apiUrl.replace(/\/$/, '')}/api/chat`;
    const messages = formatOllamaMessages(request);

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
      throw buildOllamaError(res.status, text, model);
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
    const messages = formatOllamaMessages(request);

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
      throw buildOllamaError(res.status, text, model);
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

  /**
   * Inspect Ollama /api/show metadata to determine whether the given model supports vision.
   * Returns boolean if definitively reported, or null if Ollama is unreachable / ambiguous.
   *
   * @param {string} [modelName]
   * @returns {Promise<boolean|null>}
   */
  async checkVisionSupport(modelName) {
    const targetModel = modelName || this.config?.model;
    if (!targetModel) return null;
    try {
      const apiUrl = this.config?.api_url || 'http://localhost:11434';
      const url = `${apiUrl.replace(/\/$/, '')}/api/show`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: targetModel }),
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (Array.isArray(data?.capabilities)) {
        return data.capabilities.some((cap) => String(cap).toLowerCase() === 'vision');
      }
      const families = Array.isArray(data?.details?.families) ? data.details.families : [];
      if (families.some((fam) => /clip|mllama|vision|qwen2vl|qwen25vl|gemma3/i.test(String(fam)))) {
        return true;
      }
      const infoKeys = data?.model_info && typeof data.model_info === 'object' ? Object.keys(data.model_info) : [];
      if (infoKeys.some((k) => /vision|mmproj/i.test(k))) {
        return true;
      }
      if (families.length > 0 || infoKeys.length > 0) {
        return false;
      }
      return null;
    } catch {
      return null;
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

  isCloudProvider() {
    return false;
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
