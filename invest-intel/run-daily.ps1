param(
  [string]$BotToken = $env:TELEGRAM_BOT_TOKEN,
  [string]$ChatId = $env:TELEGRAM_CHAT_ID,
  [string]$Symbols = "AAPL,MSFT,NVDA,SPY,QQQ,AMZN,META,GOOGL,TSLA,AVGO,JPM,XOM,LLY,UNH,COST,HD,PG,MA,V,ADBE",
  [double]$Capital = 100000,
  [double]$Risk = 0.01,
  [int]$Top = 10
)

if (-not $BotToken -or -not $ChatId) {
  throw "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID"
}

$env:TELEGRAM_BOT_TOKEN = $BotToken
$env:TELEGRAM_CHAT_ID = $ChatId

node "$PSScriptRoot\src\main.js" --symbols=$Symbols --capital=$Capital --risk=$Risk --top=$Top --send
