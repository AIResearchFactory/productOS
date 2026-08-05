# QA Strategy & Release Plan: Landing Page Update

## Summary
Verification matrix and release plan for landing page enhancements.

## Decisions Made
1. **QA Scenarios**:
   - Verify Hero section CTA functionality (macOS/Windows download link navigation & GitHub star badge).
   - Verify interactive demo tab switching and confirm no video modal CTA or iframe is exposed until an approved ProductOS walkthrough asset is available.
   - When a walkthrough asset is later enabled, test unavailable video content, blocked webview playback, and the inline muted video/GIF fallback.
   - Test mobile fallback card display on viewport widths < 768px.
   - Test mobile fallback copy behavior: Clipboard API success, `execCommand('copy')` success, invalid/blocked clipboard fallback, and manual URL display.
   - Validate JSON-LD syntax for `SoftwareApplication` and `FAQPage`.
   - Verify page navigation links to canonical `faq.html`, `features.html`, `compare.html`, and `data-ownership.html`; verify `vs-chatgpt.html` and `privacy.html` redirect to their canonical destinations and are not listed as canonical sitemap URLs.
2. **Release Plan**:
   - Commit all changes with conventional commit message (`feat(landing): optimize GEO/AIO, hero section conversion, and mobile fallback`).
   - Push to branch `feature/landing-page-update`.

## Open Risks
- Mobile webview video blocking remains a release-gate risk until an approved walkthrough asset and inline muted video/GIF fallback are tested.
- Zero-backend mobile fallback remains a release-gate risk until clipboard success/failure paths and manual URL display are tested across target mobile webviews.

## Artifacts Produced
- `docs/features/landing-page-update/qa-plan.md`

## Handoff to Next Agent
Ready for implementation execution.

## Blockers
None.
