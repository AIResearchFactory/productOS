# UX Specification: Landing Page Overhaul

## Summary
UX specification for the landing page optimization, focusing on immediate visual feedback above the fold, mobile webview compatibility, interactive 1-min demo modal, and scannable value propositions.

## Decisions Made
1. **Above-the-Fold Layout**:
   - 5-second formula: Headline -> Crisp 2-sentence subheadline -> Side-by-side CTA buttons -> Social proof & GitHub star count.
   - Interactive hero showcase right of headline (or stacked on mobile) with workflow tabs ("Contextual Chat", "PRD Automation", "Local Privacy").
2. **Interactive Demo Preview**:
   - Show the interactive tabbed workflow preview in the hero. Keep the "Watch 1-Min Demo 🎬" modal hidden until an approved ProductOS walkthrough URL exists; when enabled, include an inline muted video/GIF fallback for blocked webviews or playback failure.
3. **Mobile Visitor Flow**:
   - Mobile users viewing in Safari / Chrome webview see a specialized card under hero CTAs: "On mobile? Copy the download link or star on GitHub to install later on your desktop."
   - Provide a clean thumb-friendly `Copy Download Link` button (min 48px tap height, 100% width on narrow screens) and show the release URL if clipboard copy is unavailable.
4. **Machine-Readable Route Pages**:
   - Navigation links in header/footer to canonical `faq.html`, `compare.html`, and `data-ownership.html` pages with explicit comparative tables and Q&As; `vs-chatgpt.html` and `privacy.html` remain redirect aliases only.

## Open Risks
- Ensuring smooth 60fps animations on mobile devices without layout shifts (CLS).

## Artifacts Produced
- `docs/features/landing-page-update/ux-spec.md`

## Handoff to Next Agent
Handoff to **Frontend Agent** for implementation in `landing/index.html`, `landing/style.css`, and `landing/script.js`.

## Blockers
None.
