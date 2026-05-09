function quoteCmdArg(value) {
  const text = String(value);
  return /\s/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function spawnCli(spawn, command, args = [], options = {}) {
  const isWindowsShim = process.platform === 'win32' && /\.(cmd|bat)$/i.test(command);
  if (!isWindowsShim) return spawn(command, args, options);

  const comspec = process.env.ComSpec || 'cmd.exe';
  const commandLine = [quoteCmdArg(command), ...args.map(quoteCmdArg)].join(' ');
  return spawn(comspec, ['/d', '/c', commandLine], options);
}

export class AIProvider {
  /**
   * Build a single text block from a chat request suitable for CLI-based providers.
   *
   * Combines system_prompt + full message history so that CLI tools that only
   * accept a single text input still receive the complete conversation context
   * and project information the orchestrator prepared.
   *
   * API-based providers (Ollama, HostedAPI) should NOT use this – they pass
   * structured messages directly.
   *
   * @param {object} request - The chat request with messages and system_prompt
   * @returns {string} Formatted text block
   */
  buildCliInput(request) {
    const messages = request.messages || [];
    const lastMessage = messages.length > 0 ? messages[messages.length - 1].content : '';

    // If there is no system prompt and only one message, return the raw text
    // to keep simple single-turn invocations lean.
    if (!request.system_prompt && messages.length <= 1) {
      return lastMessage;
    }

    let parts = [];

    if (request.system_prompt) {
      parts.push(`[System]\n${request.system_prompt}`);
    }

    // Include prior conversation turns so the model has context
    if (messages.length > 1) {
      for (const msg of messages.slice(0, -1)) {
        const role = msg.role === 'assistant' ? 'Assistant' : 'User';
        parts.push(`[${role}]\n${msg.content}`);
      }
    }

    // Always end with the current user message
    parts.push(`[User]\n${lastMessage}`);

    return parts.join('\n\n');
  }

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
