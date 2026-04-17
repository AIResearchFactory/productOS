# Testing Stack Status

Status: Playwright is now the primary e2e framework.

## Current test split

- Node test runner for unit and integration tests under `tests/`
- Playwright for browser-first end-to-end coverage under `e2e/`

## Why this changed

The app's main surface is now browser-first. The old WDIO plus Tauri desktop harness was heavier, slower to debug, and no longer the best source of confidence for the product's primary runtime.

## Current Playwright coverage

Initial browser-first coverage includes:

- installation wizard renders in browser mode
- setup can be skipped to reach the workspace shell
- browser-first setup flow can complete
- workspace launches after setup
- core sidebar navigation can be exercised in browser mode

## Removed legacy path

- `wdio.desktop.conf.js` removed
- WDIO-based desktop e2e script removed from `package.json`

## Current scripts

- `npm run test:e2e`
- `npm run test:e2e:ui`
- `npm run test:e2e:headed`

## Follow-up ideas

A later Playwright expansion pass should cover:

- workflow builder interactions
- artifact creation and browsing
- settings navigation and browser-safe gating
- MCP/settings surface regressions

Native-only behaviors should be covered separately only if they prove important enough to justify a dedicated harness.
