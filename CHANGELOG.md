# Changelog

All notable changes to this project will be documented in this file.

## [0.4.4] - 2026-08-24

### Added
- Added Brand-Aware Presentation Engine v2 with POTX template layout preservation, custom theme colors, typography mapping, logo asset extraction, and corporate template export.
- Added PPTX sample deck uploader UI and backend template extraction service.
- Added native Mermaid diagram rendering in Markdown Document Editor and Chat Panel.
- Added Hybrid Model Router support for intelligent local/cloud LLM routing.
- Added Web Share API support with clipboard copy fallback for productOS download links on landing pages.
- Expanded GA4 telemetry coverage for UI views, error codes, user interactions, and presentation export tracking.

### Changed
- Redesigned landing page with modern graphic theme, enhanced mobile responsiveness, and updated copy.
- Improved Custom CLI streaming and robustly suppressed echoed system prompts.
- Refactored presentation tag parsing with safe text tag injection and slide classification logic.

### Fixed
- Resolved high-severity `image-size` DoS vulnerabilities via patched vendored package and dependency overrides.
- Fixed PPTX ordering to preserve interleaved body text, speaker notes, and sub-bullet hierarchy.
- Fixed landing page mobile hamburger navigation accessibility (`aria-expanded`, `aria-controls`) and dialog focus traps.
- Bumped version to 0.4.4 in package.json, package-lock.json, and CREDITS.md.

## [0.4.3] - 2026-08-01

### Added
- Added Silent Learner mode with local-first knowledge capture, semantic retrieval, memory packs, privacy controls, and health diagnostics.
- Added an OKF context layer that generates product context files and steers agent prompts from project settings.
- Added Google Antigravity (`agy`) support under the Google provider, including model discovery, auth guidance, and setup improvements.
- Added workspace recovery/recent-file sorting improvements and PPTX export enhancements.

### Changed
- Optimized prompt/context injection to reduce redundant token usage.
- Improved editor comments and revision handling for more targeted AI fixes.
- Hardened provider CLI invocation, environment detection, and large-prompt handling.

### Fixed
- Fixed chat reset/abort lifecycle issues, stale context regeneration, artifact sidecar reconciliation, transcript import privacy boundaries, and multiple UI responsiveness issues.
- Resolved dependency/security audit findings across frontend and backend dependencies.
- Bumped version to 0.4.3 in package.json and package-lock.json.
- Updated CREDITS.md to match the package.json version.

## [0.4.2] - 2026-06-04

### Changed
- Refreshed the UI of the application making it more intuitive and user friendly based on user feedback.
- The editor enabled wrking with comments and allowing the user to fix these comments with the selected AI model.
- Bumped version to 0.4.2 in package.json.
- Updated CREDITS.md to match the package.json version.
