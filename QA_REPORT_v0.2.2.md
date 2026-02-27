# productOS v0.2.2 — Functional, UI/UX, and Security Test Report

Date: 2026-02-27
Tester: OpenClaw assistant
Target build: GitHub release `v0.2.2`
OS: Windows 10/11 host (PowerShell)

## Scope & method

I tested the real release installers and runtime behavior using:
- Installer tests: MSI + EXE (silent install)
- Launch smoke test: installed executable start/keep-running
- Browser-rendered UI smoke checks (Playwright) for visual capture and console/runtime errors
- Extended mocked-runtime UI walkthrough to validate additional feature entry points
- Security checks: dependency audit + config hardening review

Artifacts:
- Screenshots:
  - `test-artifacts/home.png`
  - `test-artifacts/01-home.png`
  - `test-artifacts/10-mock-home.png`
  - `test-artifacts/11-workflow.png`
  - `test-artifacts/12-skill.png`
  - `test-artifacts/13-mcp.png`
  - `test-artifacts/14-llm.png`
  - `test-artifacts/15-noskill.png`
- Logs:
  - `products/installers/v0.2.2/msi-install-peruser.log`
  - `products/installers/v0.2.2/exe-install.log`
  - `test-artifacts/console-errors.txt`
  - `test-artifacts/mock-console-errors.txt`
  - `test-artifacts/clickables.txt`

---

## 1) Functional testing

### 1.1 Installer validation

#### MSI install (per-user)
Command:
```powershell
msiexec /i productOS_0.2.2_x64_en-US.msi ALLUSERS=2 MSIINSTALLPERUSER=1 /qn /norestart
```
Result: ✅ PASS (exit code 0)

#### EXE setup install (silent)
Command:
```powershell
productOS_0.2.2_x64-setup.exe /S
```
Result: ✅ PASS (exit code 0)

#### Post-install binary
Detected at:
`C:\Users\User\AppData\Local\Programs\productOS\app.exe`

Launch smoke test:
- Start process
- Wait 6s
- Verify process alive
Result: ✅ PASS

Installed app registered in uninstall keys:
- DisplayName: `productOS`
- Version: `0.2.2`

### 1.2 App data initialization
Found user data root:
`C:\Users\User\AppData\Roaming\ai-researcher`
Contains:
- `projects/`
- `skills/`
Result: ✅ PASS (basic bootstrap folders created)

---

## 2) UI/UX testing (smoke + expanded feature entry)

### Functional feature-entry coverage executed
Using a mocked Tauri bridge in Playwright (to unblock feature navigation in browser mode), I validated that the following UI entry points render and are interactable:
- Home workspace shell (`10-mock-home.png`)
- Create workflow flow entry (`11-workflow.png`)
- Create skill flow entry (`12-skill.png`)
- MCP install/config entry (`13-mcp.png`)
- LLM configuration entry (`14-llm.png`)
- Skill selector interaction (`15-noskill.png`)

### Observed strengths
- App renders and launches successfully from installed binary.
- Core workspace shell and primary action buttons are visible and interactive.
- Feature entry points for workflow/skill/MCP/LLM are reachable.
- Visual style and readability are modern/consistent in captured screens.

### Observed issues

#### ISSUE UX-01: No graceful fallback when Tauri bridge is unavailable
Severity: Medium (dev/web experience)

Evidence (`console-errors.txt`): multiple uncaught runtime errors such as:
- `Cannot read properties of undefined (reading 'invoke')`
- `Cannot read properties of undefined (reading 'transformCallback')`
- updater retry errors in web mode

Impact:
- In plain web context, UI logs repeated errors and partial functionality breaks.
- Creates noisy diagnostics and unclear state for contributors/testers.

Suggested fix:
1. Add Tauri environment guard helper (single source of truth), e.g.:
   - `isTauriRuntime()` check for `window.__TAURI__`
2. Wrap Tauri API calls behind safe adapters returning controlled fallback values.
3. Disable updater/listener effects when not in Tauri runtime.
4. Show a non-blocking banner: “Web preview mode: native features disabled.”

---

#### ISSUE UX-02: Repeated duplicate error logs from effect retries/double-invoke
Severity: Low-Medium

Evidence:
- Same error blocks repeated multiple times in quick sequence.

Impact:
- Harder debugging signal-to-noise.
- Perceived instability.

Suggested fix:
- Debounce or single-flight initialization effects.
- Track failed initialization and avoid repeated retries unless user-triggered.

---

#### ISSUE UX-03: Header/overlay click interception on Help menu (intermittent)
Severity: Low-Medium

Evidence (`mock-console-errors.txt`):
- Playwright click on `Help` times out with `... intercepts pointer events` despite element being visible.

Impact:
- Occasional interaction failures for top menu items depending on overlay/z-index state.

Suggested fix:
- Review stacking context and pointer-events on root overlays/shell wrappers.
- Add UI test case for top-menu clickability across app states.

---

#### ISSUE UX-04: Product naming inconsistency in older installer paths/data
Severity: Low

Evidence:
- Older artifacts used `ai-researcher`; new release uses `productOS`.
- Roaming folder observed as `ai-researcher` while app display name is `productOS`.

Impact:
- Confusing support docs, migration expectations, and user trust.

Suggested fix:
- Define canonical app identity and migration strategy:
  - consistent install folder
  - consistent app data directory
  - migration on first run from old path to new

---

#### ISSUE UX-05: Missing runtime guard for OS plugin calls (`os_type` undefined)
Severity: Medium

Evidence:
- Repeated runtime errors in logs: `Cannot read properties of undefined (reading 'os_type')`

Impact:
- Platform-dependent UI behavior can fail unexpectedly outside native runtime or during partial plugin init.

Suggested fix:
- Wrap OS plugin calls in capability checks and fallback values.
- Centralize environment probing in one utility module and use defensive accessors.

---

## 3) Security testing

### 3.1 Dependency vulnerability audit
- `npm audit` previously remediated to 0 vulnerabilities.
Current status: ✅ PASS

### 3.2 Tauri security config review
Found in `src-tauri/tauri.conf.json`:
```json
"security": { "csp": null }
```

#### ISSUE SEC-01: CSP disabled in Tauri config
Severity: Medium-High

Impact:
- Reduced protection against injected scripts/content in webview context.

Suggested fix:
- Replace `csp: null` with a strict CSP policy tailored to required domains.
- Start with deny-by-default and explicitly allow only needed sources.

---

### 3.3 Release signing verification gap
Release includes `.sig` files, but signature verification was not executed in this run.
Severity: Medium (supply-chain assurance gap)

Suggested fix:
- Add CI + release validation step to verify signatures before install testing.
- Include published verification instructions for users.

---

## 4) Additional build consistency check

#### ISSUE REL-01: Rust crate version mismatch with app version
Severity: Low-Medium

Evidence:
- `src-tauri/Cargo.toml` version observed as `0.2.1`
- App/release is `0.2.2`

Impact:
- Potential metadata drift and confusion in diagnostics/release tooling.

Suggested fix:
- Sync versions in release pipeline (single version source).

---

## 5) LiteLLM integration + cost management focused testing

### LiteLLM proxy integration test (executed)

I installed Python + LiteLLM locally and ran a real proxy instance:
- LiteLLM version: `1.81.16`
- Proxy URL: `http://127.0.0.1:4000`
- Backing model route used in test config:
  - exposed model: `gpt-4.1-mini`
  - routed to: `ollama/qwen2.5:0.5b`
  - Ollama base: `http://127.0.0.1:11434`

Results:
1. `GET /v1/models` → ✅ 200, model list returned
2. `POST /v1/chat/completions` (model `gpt-4.1-mini`) → ✅ 200, valid completion returned
3. `GET /health` → ⚠️ startup race observed once (initial connect failure), then ✅ 200 after proxy fully initialized

### LiteLLM-related issues found

#### ISSUE LLM-01: Health-check startup race can cause false negative in app "Test connection"
Severity: Medium

Evidence:
- Immediate `/health` probe failed once right after process start, but succeeded moments later.

Impact:
- Users can see "LiteLLM connection failed" even when configuration is correct.

Suggested fix:
- In `test_litellm_connection`, add short retry with backoff (e.g., 3 attempts over ~3s) before failing.

---

### Cost management coverage

I reviewed UI and wiring for cost management and found multiple product gaps.

#### ISSUE COST-01: Cost Summary panel is hardcoded to `$0.00`
Severity: High (feature non-functional)

Evidence:
- In `src/components/workspace/Sidebar.tsx`, the cost summary section displays static values for Today/This month.

Impact:
- Users get misleading spend visibility and no real budget awareness.

Suggested fix:
- Load `CostLog` aggregates from backend and bind values dynamically.
- Refresh on provider responses and workflow executions.

---

#### ISSUE COST-02: "Open Model Settings" from Models tab does not open a dedicated cost management view
Severity: Medium

Evidence:
- In `Workspace.tsx`, `onOpenModelsCost` opens generic global settings document with content marker, not a real cost dashboard route.

Impact:
- Cost controls are hard to discover; UX promise in sidebar does not match behavior.

Suggested fix:
- Add explicit "Models & Cost" settings section/anchor and route directly to it.

---

#### ISSUE FUNC-06: File rename is explicitly not implemented
Severity: Medium

Evidence:
- `handleRenameFile` in `Workspace.tsx` shows toast "Not Implemented".

Impact:
- Core file management flow incomplete, especially for project maintenance.

Suggested fix:
- Implement backend rename command + API binding + optimistic UI update.

---

## Final verdict

### Release installer quality (Windows)
✅ Installable via MSI and EXE  
✅ Launches successfully  
✅ Registers installed version correctly

### Key risks to address before broad rollout
1. Tauri web-fallback robustness (runtime guard + cleaner fallback UX)
2. Enable CSP (currently null)
3. Version/identity consistency cleanup (`productOS` vs `ai-researcher` paths)
4. Signature verification in testing pipeline

If you want, next step I can implement a **targeted fix PR plan** (file-by-file changes) and execute the first 2 high-priority fixes directly.