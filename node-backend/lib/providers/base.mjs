import { execFile } from 'node:child_process';

function quoteCmdArg(value) {
  const text = String(value);
  if (/[\0\r\n]/.test(text)) {
    throw new Error('CLI argument contains forbidden control characters');
  }
  // C-runtime quote wrapping, then escape cmd.exe metacharacters
  const cQuoted = `"${text.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, '$1$1')}"`;
  return cQuoted.replace(/([()%!^"<>&|;, ])/g, '^$1');
}

export function spawnCli(spawnFunc, command, args = [], options = {}) {
  const isWindowsShim = process.platform === 'win32' && /\.(cmd|bat)$/i.test(command);
  const { signal, ...spawnOptions } = options;

  // On POSIX, create a process group so abort signal terminates the main CLI and all spawned sub-processes
  if (process.platform !== 'win32' && spawnOptions.detached === undefined) {
    spawnOptions.detached = true;
  }

  let child;
  if (!isWindowsShim) {
    child = spawnFunc(command, args, spawnOptions);
  } else {
    const comspec = process.env.ComSpec || 'cmd.exe';
    const commandLine = [quoteCmdArg(command), ...args.map(quoteCmdArg)].join(' ');
    child = spawnFunc(comspec, ['/d', '/s', '/c', commandLine], {
      ...spawnOptions,
      windowsVerbatimArguments: true,
    });
  }

  const terminate = () => {
    const pid = child?.pid;
    if (!Number.isInteger(pid) || pid <= 0) return;
    if (process.platform === 'win32') {
      execFile('taskkill', ['/pid', String(pid), '/T', '/F'], (err) => {
        if (err) {
          try { child.kill(); } catch {}
        }
      });
    } else {
      try {
        process.kill(-pid, 'SIGTERM');
      } catch {
        try { child.kill('SIGTERM'); } catch {}
        try {
          execFile('pkill', ['-TERM', '-P', String(pid)], () => {});
        } catch {}
      }
    }
  };

  if (signal) {
    if (signal.aborted) {
      terminate();
    } else {
      signal.addEventListener('abort', terminate, { once: true });
    }
  }

  return child;
}

export function isCloudCustomCli(custom) {
  if (!custom) return true;
  if (typeof custom.isCloud === 'boolean') return custom.isCloud;
  if (typeof custom.isLocal === 'boolean') return !custom.isLocal;

  const id = String(custom.id || '');
  const name = String(custom.name || '');

  if (id.startsWith('custom-local-') || id.startsWith('local-') || id === 'local') return false;

  const tokens = [...id.split(/[-_\s/]+/), ...name.split(/[-_\s/]+/)].map((t) => t.toLowerCase());
  if (tokens.includes('local')) return false;

  return true;
}

export function isCloudProviderId(providerId, settings = {}) {
  const type = String(providerId || '');
  if (type === 'ollama' || type.startsWith('custom-local-')) return false;

  const customClis = settings.customClis || settings.custom_clis || [];
  if (Array.isArray(customClis)) {
    const custom = customClis.find(c =>
      c.id === type ||
      `custom-${c.id}` === type ||
      c.name === type ||
      `custom-${c.name}` === type
    );
    if (custom) {
      return isCloudCustomCli(custom);
    }
  }
  return true;
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
    return this.config?.model || this.config?.modelAlias || this.config?.model_alias || '';
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

  isCloudProvider() {
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
