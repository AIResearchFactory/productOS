import { fetchYahooDaily, generateSignal, sizePosition, sendTelegram } from './engine.js';

const args = process.argv.slice(2);
const send = args.includes('--send');
const symbolsArg = args.find((a) => a.startsWith('--symbols='));
const symbols = symbolsArg
  ? symbolsArg.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean)
  : ['AAPL', 'MSFT', 'NVDA', 'SPY', 'QQQ', 'AMZN', 'META', 'GOOGL', 'TSLA', 'AVGO', 'JPM', 'XOM', 'LLY', 'UNH', 'COST'];
const capitalArg = args.find((a) => a.startsWith('--capital='));
const capital = capitalArg ? Number(capitalArg.split('=')[1]) : 100000;
const riskArg = args.find((a) => a.startsWith('--risk='));
const riskPerTrade = riskArg ? Number(riskArg.split('=')[1]) : 0.01;
const topArg = args.find((a) => a.startsWith('--top='));
const topN = Math.min(10, Math.max(1, topArg ? Number(topArg.split('=')[1]) : 10));

const evaluations = [];
const failures = [];

for (const symbol of symbols) {
  try {
    const rows = await fetchYahooDaily(symbol);
    const sig = generateSignal(rows);
    const sized = sizePosition(capital, riskPerTrade, sig.entry, sig.stop);
    evaluations.push({ symbol, sig, sized });
  } catch (e) {
    failures.push(`⚠️ ${symbol}: ${e.message}`);
  }
}

const buys = evaluations
  .filter((x) => x.sig.action === 'ENTER_LONG')
  .sort((a, b) => b.sig.buyScore - a.sig.buyScore)
  .slice(0, topN);

const sells = evaluations
  .filter((x) => x.sig.action === 'EXIT_OR_AVOID')
  .sort((a, b) => b.sig.sellScore - a.sig.sellScore)
  .slice(0, topN);

const buyLines = buys.length
  ? buys.map((x, i) => `${i + 1}. ${x.symbol} | conf ${x.sig.confidence}
   Entry ${x.sig.entry.toFixed(2)} | Stop ${x.sig.stop.toFixed(2)} | Take ${x.sig.take.toFixed(2)} | Qty ${x.sized.qty}
   Why: ${x.sig.explanation}`)
  : ['No strong buy candidates today from the current universe.'];

const sellLines = sells.length
  ? sells.map((x, i) => `${i + 1}. ${x.symbol} | conf ${x.sig.confidence}
   Exit zone near ${x.sig.entry.toFixed(2)}
   Why: ${x.sig.explanation}`)
  : ['No strong sell candidates today from the current universe.'];

const report = [
  `📊 Daily Market Insights`,
  `Universe: ${symbols.length} symbols`,
  `Top Buys: ${buys.length} (max ${topN})`,
  ...buyLines,
  '',
  `Top Sells: ${sells.length} (max ${topN})`,
  ...sellLines,
  ...(failures.length ? ['', ...failures] : []),
].join('\n');

console.log(report);

if (send) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    throw new Error('Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to use --send');
  }

  // Keep each Telegram message under limit.
  const chunks = [];
  let current = '';
  for (const line of report.split('\n')) {
    if ((current + '\n' + line).length > 3500) {
      chunks.push(current);
      current = line;
    } else {
      current = current ? `${current}\n${line}` : line;
    }
  }
  if (current) chunks.push(current);

  for (const chunk of chunks) {
    await sendTelegram(token, chatId, chunk);
  }
  console.log('\n✅ Sent daily buy/sell insights to Telegram channel/chat');
}
