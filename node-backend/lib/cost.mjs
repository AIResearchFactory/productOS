import fs from 'node:fs/promises';

export class CostLog {
  constructor() {
    this.records = [];
    this.budget = {
      dailyLimitUsd: null,
      monthlyLimitUsd: null,
      currentDailyUsd: 0,
      currentMonthlyUsd: 0,
    };
  }

  static async load(path) {
    try {
      const content = await fs.readFile(path, 'utf8');
      const data = JSON.parse(content);
      const log = new CostLog();
      log.records = data.records || [];
      log.budget = { ...log.budget, ...(data.budget || {}) };
      return log;
    } catch (error) {
      if (error.code === 'ENOENT') return new CostLog();
      throw error;
    }
  }

  async save(path) {
    const data = {
      records: this.records,
      budget: this.budget,
    };
    await fs.writeFile(path, JSON.stringify(data, null, 2), 'utf8');
  }

  addRecord(record) {
    const cost = record.cost_usd || record.costUsd || 0;
    this.budget.currentDailyUsd += cost;
    this.budget.currentMonthlyUsd += cost;
    this.records.push(record);
  }

  getUsageStatistics(options = {}) {
    const stats = {
      totalPrompts: 0,
      totalResponses: 0,
      totalCostUsd: 0,
      totalTimeSavedMinutes: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheReadTokens: 0,
      totalCacheCreationTokens: 0,
      totalReasoningTokens: 0,
      totalToolCalls: 0,
      providerBreakdown: [],
    };

    const providerMap = new Map();

    for (const record of this.records) {
      const recordCost = CostLog.resolveRecordCostUsd(record, options);
      stats.totalResponses++;
      if (record.is_user_prompt || record.isUserPrompt) stats.totalPrompts++;
      stats.totalCostUsd += recordCost;
      stats.totalTimeSavedMinutes += record.time_saved_minutes || record.timeSavedMinutes || 0;
      stats.totalInputTokens += record.input_tokens || record.inputTokens || 0;
      stats.totalOutputTokens += record.output_tokens || record.outputTokens || 0;
      stats.totalCacheReadTokens += record.cache_read_tokens || record.cacheReadTokens || 0;
      stats.totalCacheCreationTokens += record.cache_creation_tokens || record.cacheCreationTokens || 0;
      stats.totalReasoningTokens += record.reasoning_tokens || record.reasoningTokens || 0;
      stats.totalToolCalls += record.tool_calls || record.toolCalls || 0;

      const provider = record.provider || 'unknown';
      if (!providerMap.has(provider)) {
        providerMap.set(provider, {
          provider,
          promptCount: 0,
          responseCount: 0,
          totalCostUsd: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCacheReadTokens: 0,
          totalCacheCreationTokens: 0,
          totalReasoningTokens: 0,
        });
      }
      const pStats = providerMap.get(provider);
      pStats.responseCount++;
      if (record.is_user_prompt || record.isUserPrompt) pStats.promptCount++;
      pStats.totalCostUsd += recordCost;
      pStats.totalInputTokens += record.input_tokens || record.inputTokens || 0;
      pStats.totalOutputTokens += record.output_tokens || record.outputTokens || 0;
      pStats.totalCacheReadTokens += record.cache_read_tokens || record.cacheReadTokens || 0;
      pStats.totalCacheCreationTokens += record.cache_creation_tokens || record.cacheCreationTokens || 0;
      pStats.totalReasoningTokens += record.reasoning_tokens || record.reasoningTokens || 0;
    }

    stats.providerBreakdown = Array.from(providerMap.values());
    return stats;
  }

  totalCost(options = {}) {
    return this.records.reduce((acc, r) => acc + CostLog.resolveRecordCostUsd(r, options), 0);
  }

  static isLocalModelName(model) {
    if (!model || typeof model !== 'string') return false;
    const lower = model.trim().toLowerCase();
    return (
      lower.includes('llama') ||
      lower.includes('mistral') ||
      lower.includes('qwen') ||
      lower.includes('deepseek') ||
      /(?:^|[^a-z])phi(?:$|[^a-z])/.test(lower) ||
      lower.includes('gemma') ||
      lower.includes('ollama') ||
      lower.startsWith('local-') ||
      lower.startsWith('custom-local-')
    );
  }

  static resolveRecordCostUsd(record, options = {}) {
    if (!record || typeof record !== 'object') return 0.0;
    const recorded = record.cost_usd ?? record.costUsd ?? 0;
    if (typeof recorded === 'number' && Number.isFinite(recorded) && recorded > 0) {
      return recorded;
    }

    const inTokens = record.input_tokens ?? record.inputTokens ?? 0;
    const outTokens = record.output_tokens ?? record.outputTokens ?? 0;
    const cacheRead = record.cache_read_tokens ?? record.cacheReadTokens ?? 0;
    const cacheWrite = record.cache_creation_tokens ?? record.cacheCreationTokens ?? 0;
    if (inTokens + outTokens + cacheRead + cacheWrite <= 0) {
      return 0.0;
    }

    const provider = record.provider || 'unknown';
    const isCloud = typeof options.isCloudProvider === 'function'
      ? options.isCloudProvider(provider, record)
      : (
          provider !== 'ollama' &&
          !String(provider).startsWith('custom-local-') &&
          !String(provider).startsWith('local-') &&
          !CostLog.isLocalModelName(record.model)
        );
    if (!isCloud) return 0.0;

    const effectiveModel =
      (typeof record.model === 'string' && record.model.trim()) ||
      (typeof options.resolveModelForProvider === 'function' ? options.resolveModelForProvider(provider) : '') ||
      provider ||
      'custom-cloud-model';

    return CostLog.computeCostUsd(effectiveModel, inTokens, outTokens, cacheRead, cacheWrite, { isCloud: true });
  }

  static computeCostUsd(model, inTokens, outTokens, cacheRead = 0, cacheWrite = 0, options = {}) {
    const safeIn = Number.isFinite(inTokens) && inTokens > 0 ? inTokens : 0;
    const safeOut = Number.isFinite(outTokens) && outTokens > 0 ? outTokens : 0;
    const safeCacheRead = Number.isFinite(cacheRead) && cacheRead > 0 ? cacheRead : 0;
    const safeCacheWrite = Number.isFinite(cacheWrite) && cacheWrite > 0 ? cacheWrite : 0;
    if (safeIn + safeOut + safeCacheRead + safeCacheWrite <= 0) return 0.0;

    if (options.isCloud === false) return 0.0;
    if (!model && options.isCloud !== true) return 0.0;
    if (options.isCloud !== true && CostLog.isLocalModelName(model)) return 0.0;

    const lower = String(model || '').toLowerCase();

    let inRate = 1.0, outRate = 3.0, cacheReadRate = 0.5, cacheWriteRate = 1.0;

    if (lower.includes('sonnet')) {
      inRate = 3.0; outRate = 15.0; cacheReadRate = 0.3; cacheWriteRate = 3.75;
    } else if (lower.includes('opus')) {
      inRate = 15.0; outRate = 75.0; cacheReadRate = 1.5; cacheWriteRate = 18.75;
    } else if (lower.includes('haiku')) {
      inRate = 0.8; outRate = 4.0; cacheReadRate = 0.08; cacheWriteRate = 1.0;
    } else if (lower.includes('gpt-4o-mini') || lower.includes('gpt-4.1-mini') || lower.includes('gpt-5-mini')) {
      inRate = 0.15; outRate = 0.6; cacheReadRate = 0.075; cacheWriteRate = 0.15;
    } else if (lower.includes('gpt-4o') || lower.includes('gpt-4.1') || lower.includes('gpt-5') || lower.includes('codex')) {
      inRate = 2.5; outRate = 10.0; cacheReadRate = 1.25; cacheWriteRate = 2.5;
    } else if (/(?:^|[-_/])o[34](?:[-_.]|$)/.test(lower)) {
      inRate = 2.0; outRate = 8.0; cacheReadRate = 0.5; cacheWriteRate = 2.0;
    } else if (/gemini.*flash/.test(lower)) {
      inRate = 0.15; outRate = 0.6; cacheReadRate = 0.0375; cacheWriteRate = 0.15;
    } else if (/gemini.*pro/.test(lower) || lower === 'gemini-default') {
      inRate = 1.25; outRate = 10.0; cacheReadRate = 0.3125; cacheWriteRate = 1.25;
    }

    const inCost = (safeIn / 1000000.0) * inRate;
    const outCost = (safeOut / 1000000.0) * outRate;
    const cacheReadCost = (safeCacheRead / 1000000.0) * cacheReadRate;
    const cacheWriteCost = (safeCacheWrite / 1000000.0) * cacheWriteRate;

    return inCost + outCost + cacheReadCost + cacheWriteCost;
  }
}
