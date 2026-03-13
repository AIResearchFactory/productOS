param(
  [Parameter(Mandatory = $true)]
  [string]$Task,

  [string]$Model = "qwen2.5:0.5b",

  [string]$RepoPath = "C:\Users\User\.openclaw\workspace\repos\productOS",

  [string]$OutDir = "C:\Users\User\.openclaw\workspace\daet-runs"
)

$ErrorActionPreference = 'Stop'

function Invoke-Phase {
  param(
    [string]$PhaseName,
    [string]$Prompt,
    [string]$OutFile
  )

  Write-Host "=== $PhaseName ===" -ForegroundColor Cyan
  $result = ollama run $Model $Prompt
  $result | Set-Content -Path $OutFile
  Write-Host "Saved: $OutFile" -ForegroundColor Green
  return $result
}

if (!(Get-Command ollama -ErrorAction SilentlyContinue)) {
  throw "Ollama CLI not found in PATH. Install/start Ollama first."
}

if (!(Test-Path $RepoPath)) {
  throw "Repo path not found: $RepoPath"
}

if (!(Test-Path $OutDir)) {
  New-Item -ItemType Directory -Path $OutDir | Out-Null
}

$runId = Get-Date -Format "yyyyMMdd-HHmmss"
$runDir = Join-Path $OutDir "daet-$runId"
New-Item -ItemType Directory -Path $runDir | Out-Null

$planPath = Join-Path $runDir "PLAN.md"
$analysisPath = Join-Path $runDir "ANALYSIS.md"
$changesPath = Join-Path $runDir "CHANGES.md"
$verificationPath = Join-Path $runDir "VERIFICATION.md"
$summaryPath = Join-Path $runDir "SUMMARY.md"

Push-Location $RepoPath
try {
  $gitStatus = git status --short
  $changedFiles = git diff --name-only

  $designPrompt = @"
You are planner agent. Task: $Task
Repository: $RepoPath
Create a concise implementation plan with phases, risks, dependencies, and acceptance criteria.
Output markdown only.
"@

  $plan = Invoke-Phase -PhaseName "Phase 1: Design" -Prompt $designPrompt -OutFile $planPath

  $analyzePrompt = @"
You are architect + security reviewer. Task: $Task
Given this plan:
$plan
Given current changed files (if any):
$changedFiles
Produce ANALYSIS.md with architecture checks, security risks, data risks, and mitigations.
Output markdown only.
"@

  $analysis = Invoke-Phase -PhaseName "Phase 2: Analyze" -Prompt $analyzePrompt -OutFile $analysisPath

  $executePrompt = @"
You are execution lead (tdd-guide style). Task: $Task
Plan:
$plan
Analysis:
$analysis
Create CHANGES.md with exact implementation steps, file-by-file edits, test-first order, and rollback notes.
Do not claim code was already changed unless explicitly verified.
Output markdown only.
"@

  $changes = Invoke-Phase -PhaseName "Phase 3: Execute" -Prompt $executePrompt -OutFile $changesPath

  $verifyPrompt = @"
You are e2e/code/security verifier. Task: $Task
Plan:
$plan
Analysis:
$analysis
Proposed changes:
$changes
Current git status:
$gitStatus
Create VERIFICATION.md with:
- test commands to run
- expected pass criteria
- regression/security checks
- release readiness (READY / NEEDS FOLLOW-UP / BLOCKED)
Output markdown only.
"@

  $verification = Invoke-Phase -PhaseName "Phase 4: Test & Verify" -Prompt $verifyPrompt -OutFile $verificationPath

  $summary = @"
# DAET Run Summary

- Run ID: $runId
- Model: $Model
- Task: $Task
- Repo: $RepoPath

## Artifacts
- PLAN: $planPath
- ANALYSIS: $analysisPath
- CHANGES: $changesPath
- VERIFICATION: $verificationPath

## Final Note
This local DAET run used Ollama directly (no OpenCode provider dependency).
"@
  $summary | Set-Content -Path $summaryPath

  Write-Host "`nDAET local run complete." -ForegroundColor Green
  Write-Host "Run dir: $runDir" -ForegroundColor Yellow
}
finally {
  Pop-Location
}
