# Investment Insight Engine (MVP)

This is a local-first MVP that:
- Pulls daily market prices from Yahoo Finance public chart endpoint
- Generates trend signals (SMA crossover + momentum)
- Applies basic risk sizing
- Produces actionable entry/exit insights
- Optionally sends insights to a dedicated Telegram channel

## Quick start

```bash
cd invest-intel
npm start
```

## Configure dedicated Telegram channel (optional)

Set env vars:

- `TELEGRAM_BOT_TOKEN` = Bot token
- `TELEGRAM_CHAT_ID` = Channel ID (example: `-1001234567890`) or user/chat id

Then run:

```bash
$env:TELEGRAM_BOT_TOKEN="..."
$env:TELEGRAM_CHAT_ID="-1001234567890"
node src/main.js --send
```

## Example

```bash
node src/main.js --symbols=AAPL,MSFT,NVDA,SPY,QQQ --capital=100000 --risk=0.01 --top=10 --send
```

- `--top=10` limits each list to max 10 buys and max 10 sells.
- Each pick includes a short explanation (`Why:`).

## Daily automation on Windows (Task Scheduler)

Run once per day (example 09:00):

```powershell
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File C:\Users\User\.openclaw\workspace\invest-intel\run-daily.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At 9:00am
Register-ScheduledTask -TaskName "InvestIntelDaily" -Action $action -Trigger $trigger -Description "Daily buy/sell insights to Telegram"
```

Before scheduling, set your env vars once in your user session/profile:

```powershell
setx TELEGRAM_BOT_TOKEN "<your_bot_token>"
setx TELEGRAM_CHAT_ID "-1001234567890"
```

## Notes

- This is decision support, not financial advice.
- Use paper trading first.
- Add your broker integration only after stable backtest + paper phase.
