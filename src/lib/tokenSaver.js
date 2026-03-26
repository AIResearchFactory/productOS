function estimateTokens(text = '') {
  return Math.ceil(String(text).length / 4);
}

function compactMessages(messages = [], keepRecentTurns = 6) {
  const system = messages.filter((m) => m.role === 'system');
  const nonSystem = messages.filter((m) => m.role !== 'system');

  if (nonSystem.length <= keepRecentTurns) {
    return { messages, saved: 0, action: 'none' };
  }

  const old = nonSystem.slice(0, nonSystem.length - keepRecentTurns);
  const recent = nonSystem.slice(nonSystem.length - keepRecentTurns);

  const summary = old
    .map((m) => `${m.role}: ${String(m.content || '').slice(0, 140)}`)
    .join(' | ')
    .slice(0, 1000);

  const summaryMsg = {
    role: 'system',
    content: `Compressed context summary: ${summary}`,
  };

  const oldTokens = old.reduce((s, m) => s + estimateTokens(m.content || ''), 0);
  const newTokens = estimateTokens(summaryMsg.content);

  return {
    messages: [...system, summaryMsg, ...recent],
    saved: Math.max(0, oldTokens - newTokens),
    action: 'history_compaction',
  };
}

export function isTokenSaverEnabled() {
  try {
    return typeof window !== 'undefined' && localStorage.getItem('productos.tokenSaver.enabled') === 'true';
  } catch {
    return false;
  }
}

export function setTokenSaverEnabled(enabled) {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('productos.tokenSaver.enabled', enabled ? 'true' : 'false');
    }
  } catch {
    // ignore localStorage issues
  }
}

export function optimizeMessagesForSend(messages = [], config = {}) {
  const raw = messages.reduce((s, m) => s + estimateTokens(m.content || ''), 0);
  const keepRecentTurns = config.keepRecentTurns ?? 6;
  const optimized = compactMessages(messages, keepRecentTurns);
  const opt = optimized.messages.reduce((s, m) => s + estimateTokens(m.content || ''), 0);

  return {
    messages: optimized.messages,
    receipt: {
      input_tokens_raw: raw,
      input_tokens_optimized: opt,
      saved_tokens: Math.max(0, raw - opt),
      saved_pct: raw > 0 ? Number((((raw - opt) / raw) * 100).toFixed(2)) : 0,
      actions: [{ type: optimized.action, saved: optimized.saved }],
    },
  };
}
