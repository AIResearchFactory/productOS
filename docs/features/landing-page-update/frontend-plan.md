# Frontend Implementation Plan: Landing Page

## Summary
Technical frontend plan for modifying `landing/index.html`, `landing/style.css`, `landing/script.js`, and creating dedicated machine-readable pages (`faq.html`, `vs-chatgpt.html`, `privacy.html`).

## Decisions Made
1. **HTML & Metadata (`landing/index.html`)**:
   - Inject rich `SoftwareApplication` and `FAQPage` JSON-LD schema into `<head>`.
   - Restructure `#hero` section with crisp headlines, sub-headlines, dual CTAs, interactive tabbed UI mockup, and mobile quick-save component.
   - Insert dedicated FAQ section with accordion interaction and `itemscope` schema attributes.
2. **CSS Styling (`landing/style.css`)**:
   - Add styles for dual hero CTAs (`.btn-primary`, `.btn-secondary`) and keep demo CTA styles unused until an approved video exists.
   - Add `.hero-interactive-demo`, `.demo-tabs`, `.demo-screen`, `.mobile-fallback-card` with dark glassmorphism aesthetic.
   - Ensure mobile responsiveness for webviews (Safari/Chrome on iOS/Android).
3. **JS Logic (`landing/script.js`)**:
   - Add interactive demo tab switcher logic; do not enable a video modal until an approved ProductOS walkthrough URL and inline muted video/GIF fallback are available.
   - Add mobile detection and quick-save link-copy fallback logic with manual URL display when clipboard copy fails.
   - Add FAQ accordion script with ARIA updates.
4. **Machine-Readable Route Pages**:
   - `landing/faq.html` - Dedicated Q&A page for AI crawlers & users.
   - `landing/compare.html` - Comparison table (ProductOS vs ChatGPT); `landing/vs-chatgpt.html` remains a redirect alias.
   - `landing/data-ownership.html` - Canonical local privacy & AES-256 data storage explanation; `landing/privacy.html` remains a redirect alias.

## Open Risks
- Validation of JSON-LD schemas against Google Rich Results & schema.org standard.

## Artifacts Produced
- `docs/features/landing-page-update/frontend-plan.md`

## Handoff to Next Agent
Handoff to **QA & E2E Agents** for verification strategy and execution.

## Blockers
None.
