# TEST_RUNBOOK.md — productOS Test Execution Guide

## Goal
Make it clear which tests run locally, which run in CI, and how to validate features and security fixes reliably.

## Test Categories

### 1. Fast Local & Backend Checks
Use these before committing local feature or bug-fix work:

```bash
npm run build
npm test
npm run test:backend
```

Targeted suites:
```bash
npm run test:mvp:personal-pm
npm run test:channels
npm run test:guardrails
npm run test:starter-pack
npm run test:integration:token-saver
```

### 2. Browser End-to-End Tests (Playwright)

```bash
npm run test:e2e         # Run Playwright E2E tests
npm run test:e2e:ci      # Run CI wrapper against isolated test projects
npm run test:e2e:ui      # Interactive Playwright UI mode
```

Ensure Chromium is installed if running Playwright locally for the first time:
```bash
npx playwright install chromium
```

### 3. Security & Dependency Hygiene

```bash
npm audit --audit-level=high
```

## Notes
- Always isolate test runs using temporary `HOME`, `APP_DATA_DIR`, and `PROJECTS_DIR` paths so user workspace data is untouched.
- Never commit `.test-data-*` directories or `secrets.encrypted.json`.
