# TEST_RUNBOOK.md — productOS Test Execution Guide

## Goal
Make it obvious which tests are expected to pass locally, which are CI-dependent, and how to validate new features safely.

## Test categories

### 1. Fast local checks
Use these before committing local feature work.

```bash
npm run build
npm run test:mvp:personal-pm
npm run test:channels
```

Expected:
- should pass on a normal local dev machine without special drivers

### 2. Rust backend checks
Use when touching `src-tauri` services/commands.

```bash
cd src-tauri
cargo test -q
cargo check -q
```

Expected:
- may require local environment consistency
- use targeted tests first when changing specific modules

### 3. Desktop E2E (CI-preferred)

```bash
npm run test:e2e:desktop
```

Important:
- local execution may fail if WebDriver / Edge driver is not installed
- CI is the source of truth for full desktop e2e validation

Known local blocker example:
- missing `msedgedriver.exe`
- no WebDriver endpoint at `localhost:4444`

## Feature-to-test mapping

### Personal onboarding / starter pack / guardrails
Run:
```bash
npm run test:mvp:personal-pm
npm run build
```

Or use smaller targeted checks:
```bash
npm run test:guardrails
npm run test:starter-pack
npm run test:integration:token-saver
```

### Chat channels settings UI
Run:
```bash
npm run test:channels
npm run build
```

### Full desktop smoke flows
Run in CI or on a machine with WebDriver configured:
```bash
npm run test:e2e:desktop
```

## Rule of thumb
- Use fast local checks for every small delivery
- Use CI for browser/desktop confidence
- Do not treat local WebDriver failures as feature regressions unless app logic changed
