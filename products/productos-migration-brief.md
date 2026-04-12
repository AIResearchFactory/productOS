# productOS Migration Brief

## Goal
Design the future version of productOS as a browser-based, cross-platform system with **no desktop requirement**, **no OS signing dependency**, and **npm as the primary toolchain** for development, packaging, and operations.

This brief is written to be reviewed internally, shared with collaborators, or imported into tools like NotebookLM for discussion and planning.

---

# 1. Executive Summary

productOS should migrate away from a desktop-first distribution model and move toward a **browser-first local runtime architecture**.

The target system should:
- run across Windows, macOS, and Linux without depending on desktop installers as the primary delivery model
- avoid OS signing, notarization, and native package management complexity
- use npm as the main developer and release workflow entry point
- preserve the core value of productOS: projects, providers, workflows, recurring automation, research, and outputs

The future productOS should be:
- **web-first**
- **runtime-backed**
- **npm-operated**
- **cross-platform by design**

Instead of shipping a native desktop shell as the primary product, productOS would run as a **local service plus browser UI**.

---

# 2. Why Migrate

## Current pressure points
The current desktop-first architecture creates repeated operational friction:
- Windows installer complexity
- macOS signing and notarization burden
- OS-specific packaging artifacts
- release pipeline complexity
- native-shell-specific bugs
- onboarding behavior tied to platform-specific command execution

## What this migration solves
A browser-first runtime design reduces:
- platform-specific packaging work
- signing/notarization requirements
- installer distribution complexity
- desktop-shell coupling

It improves:
- cross-OS consistency
- release simplicity
- developer workflow clarity
- portability
- future hosted/self-hosted options

---

# 3. Product Principle

## Future product definition
productOS is not a desktop app.

productOS is:
- a local AI work runtime
- a browser UI for interacting with that runtime
- a system for structured AI projects, workflows, and outputs

Desktop packaging may exist later as an optional shell, but it should not be the foundation of the product.

---

# 4. Target Architecture

## Core layers

### A. Browser UI
This becomes the primary user experience.

Responsibilities:
- onboarding
- project creation
- research views
- workflow configuration
- settings
- outputs and generated docs
- provider display/status

### B. Local runtime service
This becomes the operating engine.

Responsibilities:
- project storage
- provider orchestration
- workflow scheduling
- recurring jobs
- file generation
- settings persistence
- provider detection
- long-running execution

### C. Shared core/domain layer
This contains reusable product logic.

Responsibilities:
- schemas
- project types
- workflow definitions
- output models
- shared validation and domain logic

---

# 5. Target Repository Structure

```text
productOS/
  apps/
    web/                 # browser UI
  services/
    runtime/             # local service / orchestration engine
  packages/
    core/                # shared domain logic, schemas, types
    sdk/                 # typed API client used by web app
    ui/                  # shared UI primitives if needed
  scripts/
  docs/
```

## Explanation

### `apps/web`
Contains the browser interface.
Likely React-based.

### `services/runtime`
Contains the local API server and execution engine.
Could be Node-based or Rust-based, but should be accessible via HTTP/WebSocket.

### `packages/core`
Contains shared product logic independent of UI/runtime shell decisions.

### `packages/sdk`
Gives the frontend a typed, stable interface to the runtime.

### `packages/ui`
Optional, only if shared component design system is needed.

---

# 6. Runtime Model

## Recommended runtime behavior
A user installs productOS, then runs:

```bash
npm run dev
```
for development or

```bash
npm run start
```
for local usage.

Internally, this should:
- start the local runtime service
- start or serve the browser UI
- open the browser automatically if desired

The user then interacts with productOS at:
- `http://localhost:<port>`

## Why this matters
This avoids:
- native desktop app packaging as the primary delivery path
- OS installer dependency
- notarization/signing requirements

---

# 7. npm as the Tool of Choice

## Principle
npm should be the main operational interface for developers and users.

## Examples of target commands

### Development
```bash
npm install
npm run dev
```

### Build
```bash
npm run build
```

### Start runtime locally
```bash
npm run start
```

### Run migrations/tasks
```bash
npm run setup
npm run doctor
npm run providers:check
npm run workflow:test
```

### Release packaging
```bash
npm run package
```

The system should prefer npm-based orchestration over native app packaging pipelines.

---

# 8. Delivery Model

## Preferred delivery
Ship productOS as:
- source via GitHub
- npm-driven local app/runtime
- optionally a zip bundle of the built web app + runtime

## Avoid as primary release outputs
- MSI as the core product identity
- DMG as the primary user story
- native-signing-heavy release flow
- OS-specific installer logic at the heart of shipping

## Optional later
Portable wrappers may still be offered later, but they should be secondary convenience layers.

---

# 9. What Must Stay Intact

The migration must preserve these core product concepts:
- projects
- provider flexibility
- workflows
- recurring automation
- research and synthesis
- outputs such as PRDs and internal docs
- local + cloud model support

This is an architectural migration, not a product reset.

---

# 10. Core API Surface

The current desktop command surface should be converted into a runtime API.

## Candidate API groups

### Projects
- create project
- list projects
- update project
- load project context

### Providers
- detect providers
- get provider status
- update provider settings
- choose provider per task

### Workflows
- create workflow
- list workflows
- run workflow
- schedule workflow

### Outputs
- generate research brief
- generate PRD
- generate summary
- store output artifacts

### Settings
- load settings
- save settings
- system health

### Jobs
- track background task progress
- live status updates

---

# 11. Migration Plan

## Phase 1. Define the boundary
Inventory all current desktop-native commands and group them into API domains.

### Output of phase 1
A list of:
- commands
- owners
- dependencies
- required runtime behaviors

## Phase 2. Build the runtime skeleton
Create a local runtime service with:
- HTTP API
- config storage
- health endpoint
- provider status endpoint

### Minimum proof
Browser UI can load provider status and create a basic project.

## Phase 3. Move onboarding and settings
Convert:
- provider detection
- settings persistence
- project creation

from desktop-native bridges to runtime API calls.

## Phase 4. Move research execution
Move:
- provider execution
- research jobs
- result generation

into the runtime service.

## Phase 5. Move workflows and scheduling
Move:
- recurring jobs
- daily updates
- background task orchestration

into runtime.

## Phase 6. Make browser UI primary
At this point, productOS should function fully without a desktop shell.

## Phase 7. De-emphasize or remove native shell
If desktop wrapping still exists, it becomes optional.

---

# 12. UX Changes

## Onboarding
Current onboarding likely assumes desktop-native provider behavior.

Future onboarding should:
- check runtime health
- detect available providers
- show install/login guidance
- avoid shell-specific logic where possible

## Settings
Settings should reflect runtime state, not desktop app state.

## Workflows
Workflows should be created and monitored through browser UI, but executed by runtime.

---

# 13. Risks

## Migration complexity
This is a real refactor, not a cosmetic change.

## Temporary dual architecture
There may be a period where desktop and runtime-based flows coexist.

## Runtime lifecycle concerns
You must design:
- port handling
- startup reliability
- logs
- health checks
- shutdown behavior

## Feature parity risk
The migration should be phased to avoid losing working product features.

---

# 14. Benefits

## Operational benefits
- no primary OS signing requirement
- fewer packaging headaches
- simpler release pipeline
- better cross-platform consistency

## Product benefits
- easier future browser-hosted evolution
- cleaner system boundaries
- better support for team/self-hosted deployment models

## Developer benefits
- npm-first workflow
- simpler local setup
- more standard frontend/backend architecture

---

# 15. Recommended Technical Direction

## Preferred model
**Browser UI + local runtime service + npm-first workflows**

### Why this is preferred
- aligns with the goal of no OS signing requirement
- keeps productOS cross-platform
- preserves current product value
- simplifies development and releases

## Shell guidance
Do not make a desktop wrapper the primary product.
If one exists later, it should only be a convenience layer.

---

# 16. First Concrete Milestone

## Recommended first migration slice
Move only these three capabilities first:
- provider detection
- settings
- project creation

### Why
This gives a meaningful browser-first onboarding proof without requiring a full system rewrite immediately.

If this works well, the next slices are:
- research execution
- output generation
- workflows and scheduling

---

# 17. Release Model After Migration

## Public release philosophy
The release should provide:
- source zip/tarball
- npm-based install/start path
- optionally a packaged convenience bundle

## Avoid relying on
- signed desktop installers as the main user path
- notarization-heavy release gates
- platform-specific app identity as the center of the product

---

# 18. Architecture Statement

**productOS should become a browser-based AI operating system backed by a local runtime service, using npm as the primary toolchain and avoiding OS signing by removing desktop-native packaging as the primary delivery model.**

---

# 19. Review Questions

Before execution, stakeholders should align on:
- Do we want to fully drop desktop as a requirement?
- Which runtime technology should own orchestration?
- What is the first milestone that proves the model works?
- Which current desktop-native features are critical to preserve in phase 1?
- What should the new install/start experience be for end users?

---

# 20. Recommended Decision

Proceed with a migration plan toward:
- browser-first UI
- local runtime backend
- npm-first workflows
- no desktop requirement
- no OS signing requirement as a core release dependency

This is the cleanest path to a cross-platform productOS that is easier to build, ship, and maintain.
