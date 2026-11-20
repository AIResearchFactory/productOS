# Release Checklist

Quick reference guide for creating and verifying a new `productos` npm and GitHub release.

## Pre-Release Verification

- [ ] `npm audit --audit-level=high` reports 0 vulnerabilities
- [ ] `npm test` passes (all backend & unit suites)
- [ ] `npm run build` (`tsc && vite build`) succeeds cleanly
- [ ] `CHANGELOG.md` updated with release notes for the target version
- [ ] `CREDITS.md` up to date if dependencies changed (`npm run generate-credits`)

## Release Process (Automated via GitHub Actions)

1. Go to **GitHub → Actions → Release** (`.github/workflows/release.yml`).
2. Click **Run workflow** on `main`:
   - Leave `version_override` blank to bump the patch version, or specify an explicit SemVer version (`X.Y.Z`).
3. Wait for the `test` job to pass (`npm run test:backend` + `npm run build`).
4. Approve the `npm-publish` environment gate.
5. Verify the `publish` job:
   - Updates `package.json` & `package-lock.json` and commits `chore: bump version to vX.Y.Z [skip ci]`
   - Creates and pushes Git tag `vX.Y.Z`
   - Publishes `productos@X.Y.Z` to npm with `--provenance`
   - Creates the GitHub Release `productOS vX.Y.Z`
6. Verify the `verify-release` job:
   - Confirms registry propagation (`https://registry.npmjs.org/productos/X.Y.Z`)
   - Runs `npm install -g productos@X.Y.Z`
   - Passes `PRODUCTOS_E2E_VERIFY_RELEASE=true CI=true npm run test:e2e:ci`

## Version Numbering

Follow [Semantic Versioning](https://semver.org/):
- **Major (`X.0.0`)**: Breaking changes
- **Minor (`0.X.0`)**: New features (backward compatible)
- **Patch (`0.0.X`)**: Bug fixes (backward compatible)

## Rollback / Patch Forward

If a release has a regression:
1. Fix the issue on `main` and add regression tests.
2. Trigger a new patch release (`X.Y.(Z+1)`) via the **Release** workflow.
3. Users upgrade via `npm install -g productos@latest` or `npx productos@latest`.
