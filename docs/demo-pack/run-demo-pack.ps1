param(
  [switch]$SkipVideo,
  [switch]$SkipStills,
  [switch]$SkipSimulation
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$remotionDir = Join-Path $root 'remotion'
$simScript = Join-Path $root 'simulation\simulate-demo-pack.mjs'

Write-Host "== productOS Demo Pack Runner ==" -ForegroundColor Cyan
Write-Host "Root: $root"

if (-not $SkipSimulation) {
  Write-Host "[1/3] Running simulation..." -ForegroundColor Yellow
  node $simScript
}

Push-Location $remotionDir
try {
  Write-Host "Installing Remotion deps (if needed)..." -ForegroundColor Yellow
  npm install | Out-Null

  if (-not $SkipStills) {
    Write-Host "[2/3] Rendering stills..." -ForegroundColor Yellow
    npx remotion still src/entry.jsx Case01 out/case01.png
    npx remotion still src/entry.jsx Case02 out/case02.png
    npx remotion still src/entry.jsx Case03 out/case03.png
    npx remotion still src/entry.jsx Case04 out/case04.png
  }

  if (-not $SkipVideo) {
    Write-Host "[3/3] Rendering full demo video..." -ForegroundColor Yellow
    npx remotion render src/entry.jsx DemoPack out/demo-pack.mp4
  }
}
finally {
  Pop-Location
}

Write-Host "Done. Outputs:" -ForegroundColor Green
Write-Host "- Simulation: docs/demo-pack/simulation/out/"
Write-Host "- Stills: docs/demo-pack/remotion/out/case01.png .. case04.png"
Write-Host "- Video: docs/demo-pack/remotion/out/demo-pack.mp4"
