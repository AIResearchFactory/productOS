function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr) {
  const m = mean(arr);
  const v = mean(arr.map((x) => (x - m) ** 2));
  return Math.sqrt(v);
}

function rolling(values, window, fn) {
  const out = Array(values.length).fill(null);
  for (let i = window - 1; i < values.length; i++) {
    out[i] = fn(values.slice(i - window + 1, i + 1));
  }
  return out;
}

function pctChange(values, lag = 1) {
  const out = Array(values.length).fill(null);
  for (let i = lag; i < values.length; i++) {
    out[i] = (values[i] - values[i - lag]) / values[i - lag];
  }
  return out;
}

export async function fetchYahooDaily(symbol, range = '1y', interval = '1d') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=${interval}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error('No data');

  const ts = result.timestamp || [];
  const q = result.indicators?.quote?.[0] || {};
  const closes = q.close || [];

  const rows = [];
  for (let i = 0; i < closes.length; i++) {
    if (closes[i] == null) continue;
    rows.push({
      ts: new Date(ts[i] * 1000).toISOString(),
      close: Number(closes[i]),
    });
  }
  return rows;
}

export function generateSignal(rows, fastWindow = 20, slowWindow = 50) {
  const closes = rows.map((r) => r.close);
  const ret1 = pctChange(closes, 1);
  const mom20 = pctChange(closes, 20);
  const fast = rolling(closes, fastWindow, mean);
  const slow = rolling(closes, slowWindow, mean);
  const vol20 = rolling(ret1.map((x) => (x ?? 0)), 20, (x) => std(x) * Math.sqrt(252));

  const i = closes.length - 1;
  if (i < slowWindow) throw new Error('Not enough data');

  const fastNow = fast[i];
  const slowNow = slow[i];
  const momentum20 = mom20[i] ?? 0;
  const volatility20 = vol20[i] ?? 0;
  const trendStrength = Math.abs((fastNow - slowNow) / slowNow);

  let action = 'HOLD_WAIT';
  let regime = 'MIXED';
  if (fastNow > slowNow && momentum20 > 0) {
    action = 'ENTER_LONG';
    regime = 'TREND_UP';
  } else if (fastNow < slowNow && momentum20 < 0) {
    action = 'EXIT_OR_AVOID';
    regime = 'TREND_DOWN';
  }

  let confidence = Math.min(0.95, Math.max(0.05, trendStrength * 10 + Math.max(0, momentum20) * 2));
  if (volatility20 > 0.45) confidence *= 0.7;

  const buyScore = Math.max(0, (fastNow - slowNow) / slowNow) * 4 + Math.max(0, momentum20) * 3 - volatility20 * 0.5;
  const sellScore = Math.max(0, (slowNow - fastNow) / slowNow) * 4 + Math.max(0, -momentum20) * 3 + volatility20 * 0.2;

  const entry = closes[i];
  const atrProxy = Math.max(0.01, Math.min(0.05, volatility20 / 10));
  const stop = entry * (1 - 2 * atrProxy);
  const take = entry * (1 + 3 * atrProxy);

  const explanation =
    action === 'ENTER_LONG'
      ? `Uptrend confirmed (SMA${fastWindow}>SMA${slowWindow}), 20d momentum positive (${(momentum20 * 100).toFixed(1)}%), volatility ${(volatility20 * 100).toFixed(1)}% annualized.`
      : action === 'EXIT_OR_AVOID'
        ? `Downtrend confirmed (SMA${fastWindow}<SMA${slowWindow}), 20d momentum negative (${(momentum20 * 100).toFixed(1)}%), caution on downside continuation.`
        : `Mixed setup: trend and momentum not aligned (momentum ${(momentum20 * 100).toFixed(1)}%, volatility ${(volatility20 * 100).toFixed(1)}%).`;

  return {
    action,
    regime,
    confidence: Number(confidence.toFixed(2)),
    entry,
    stop,
    take,
    buyScore,
    sellScore,
    explanation,
  };
}

export function sizePosition(capital, riskPerTrade, entry, stop) {
  const budget = capital * riskPerTrade;
  const perShareRisk = Math.max(0.01, Math.abs(entry - stop));
  const qty = Math.floor(budget / perShareRisk);
  const notional = qty * entry;
  return { qty, notional };
}

export async function sendTelegram(botToken, chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) throw new Error(`Telegram HTTP ${res.status}`);
}
