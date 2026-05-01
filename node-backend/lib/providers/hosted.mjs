import { AIProvider } from './base.mjs';

export class HostedAPIProvider extends AIProvider {
  constructor(config) {
    super();
    this.config = config;
  }

  async chat(request) {
    // Basic implementation for Hosted API (OpenAI-compatible)
    const apiUrl = this.config?.api_url || this.config?.baseUrl || 'http://localhost:8080';
    const url = `${apiUrl.replace(/\/$/, '')}/chat/completions`;
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
