# CI/CD Setup for productOS Releases

This document describes the CI/CD automation setup for testing, building, and publishing `productos` to npm and GitHub Releases.

## Overview

The CI/CD pipelines are defined in `.github/workflows/`:
1. **Continuous Testing (`.github/workflows/test.yml`)**: Runs `npm audit --audit-level=high`, backend tests (`npm run test:backend`), frontend TypeScript + Vite build (`npm run build`), and Playwright E2E tests (`npm run test:e2e:ci`).
2. **Release Publishing (`.github/workflows/release.yml`)**: Triggered manually via `workflow_dispatch` by authorized maintainers (`AIResearchFactory/productOS`). Bumps version, tags, builds frontend assets, publishes `productos` to npm with `--provenance`, creates a GitHub Release, and verifies global installation via Playwright E2E tests.
3. **Landing Page Deployment (`.github/workflows/deploy-landing.yml`)**: Deploys `./landing` to GitHub Pages.

## Permissions & Environments

- **npm Provenance (`id-token: write`)**: Trusted publishing / OIDC provenance via GitHub Actions environment `npm-publish` (manual approval gate).
- **`GITHUB_TOKEN` (`contents: write`)**: Used by `release.yml` to commit version bumps, push Git tags (`vX.Y.Z`), and create the GitHub Release via `softprops/action-gh-release@v2`.

## How to Create a Release

1. Ensure all tests and builds pass on `main`:
   ```bash
   npm audit --audit-level=high
   npm test
   npm run build
   ```
2. Navigate to **Actions → Release → Run workflow** in GitHub.
3. Optionally enter a `version_override` (e.g., `0.5.0`), or leave blank to bump the patch version automatically.
4. Approve the `npm-publish` deployment gate when prompted.
5. Verify the published package on npm (`https://www.npmjs.com/package/productos`) and the GitHub Release assets, plus the `verify-release` job output.
