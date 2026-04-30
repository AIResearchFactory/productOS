# Release Notes - v0.3.0

## 🚀 New Capabilities & Improvements

- implement workflow progress tracking in headless mode
- dispatch settings-changed event after saving project settings
- add detailed trace logging to agent orchestrator
- implement server-side dialogs (open/save/ask)
- standardize Custom CLI ID prefixing and fix provider selection issues
- implement startup health check interceptor for offline resilience
- add Server Offline persona overlay for headless PWA mode
- migrate PWA manifest to external file and add debug logging to PWA hook
- add favicon to index and update service worker caching configuration
- enhance shutdown UX with premium animation and same-tab redirect

## 🛠️ Stability & Fixes

- resolve Ollama model selection and export dialog defects
- restore default-features = false for rfd to prevent async runtime conflicts on linux
- restore native dialog support on macOS and browser fallbacks for headless prompts
- resolve aria-describedby issues and restore native dialogs in headless mode
- resolve accessibility warnings for dialog components
- Major E2E test suite stabilization and reliability improvements.
- Optimized idle CPU and memory usage.

## Contributors

- Assaf Miron
- Avia Tam
- OpenClaw Assistant

> Full commit details are available in the repository history.