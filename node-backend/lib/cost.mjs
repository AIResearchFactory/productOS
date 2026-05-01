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
    this.budget.currentDailyUsd += record.cost_usd;
    this.budget.currentMonthlyUsd += record.cost_usd;
    this.records.push(record);
  }

  getUsageStatistics() {
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
      stats.totalResponses++;
      if (record.is_user_prompt) stats.totalPrompts++;
      stats.totalCostUsd += record.cost_usd;
      stats.totalTimeSavedMinutes += record.time_saved_minutes || 0;
      stats.totalInputTokens += record.input_tokens || 0;
      stats.totalOutputTokens += record.output_tokens || 0;
      stats.totalCacheReadTokens += record.cache_read_tokens || 0;
      stats.totalCacheCreationTokens += record.cache_creation_tokens || 0;
      stats.totalReasoningTokens += record.reasoning_tokens || 0;
      stats.totalToolCalls += record.tool_calls || 0;

      const provider = record.provider || 'unknown';
      if (!providerMap.has(provider)) {
        providerMap.set(provider, {
          provider,
          promptCount: 0,
          responseCount: 0,
          totalCostUsd: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
        });
      }
      const pStats = providerMap.get(provider);
      pStats.responseCount++;
      if (record.is_user_prompt) pStats.promptCount++;
      pStats.totalCostUsd += record.cost_usd;
      pStats.totalInputTokens += record.input_tokens || 0;
      pStats.totalOutputTokens += record.output_tokens || 0;
    }

    stats.providerBreakdown = Array.from(providerMap.values());
    return stats;
  }

  totalCost() {
    return this.records.reduce((acc, r) => acc + (r.cost_usd || 0), 0);
  }

  static computeCostUsd(model, inTokens, outTokens, cacheRead = 0, cacheWrite = 0) {
    const lower = model.toLowerCase();
    
    // Check for local models
    if (lower.includes('llama') || lower.includes('mistral') || lower.includes('qwen') || 
        lower.includes('deepseek') || lower.includes('phi')) {
      return 0.0;
    }

    let inRate = 1.0, outRate = 3.0, cacheReadRate = 0.5, cacheWriteRate = 1.0;

    if (lower.includes('sonnet')) {
      inRate = 3.0; outRate = 15.0; cacheReadRate = 0.3; cacheWriteRate = 3.75;
    } else if (lower.includes('opus')) {
      inRate = 15.0; outRate = 75.0; cacheReadRate = 1.5; cacheWriteRate = 18.75;
    } else if (lower.includes('haiku')) {
      inRate = 0.25; outRate = 1.25; cacheReadRate = 0.03; cacheWriteRate = 0.3;
    } else if (lower.includes('gpt-4o')) {
      inRate = 5.0; outRate = 15.0; cacheReadRate = 2.5; cacheWriteRate = 5.0;
    } else if (lower.includes('gemini-1.5-pro') || lower.includes('gemini-2.0-pro')) {
      inRate = 3.5; outRate = 10.5; cacheReadRate = 0.7; cacheWriteRate = 3.5;
    } else if (lower.includes('gemini-1.5-flash') || lower.includes('gemini-2.0-flash')) {
      inRate = 0.075; outRate = 0.3; cacheReadRate = 0.015; cacheWriteRate = 0.075;
    }

    const inCost = (inTokens / 1000000.0) * inRate;
    const outCost = (outTokens / 1000000.0) * outRate;
    const cacheReadCost = (cacheRead / 1000000.0) * cacheReadRate;
    const cacheWriteCost = (cacheWrite / 1000000.0) * cacheWriteRate;

    return inCost + outCost + cacheReadCost + cacheWriteCost;
  }
}
