# UX Specification: Landing Page Overhaul

## Summary
UX specification for the landing page optimization, focusing on immediate visual feedback above the fold, mobile webview compatibility, interactive 1-min demo modal, and scannable value propositions.

## Decisions Made
1. **Above-the-Fold Layout**:
   - 5-second formula: Headline -> Crisp 2-sentence subheadline -> Side-by-side CTA buttons -> Social proof & GitHub star count.
   - Interactive hero showcase right of headline (or stacked on mobile) with workflow tabs ("Contextual Chat", "PRD Automation", "Local Privacy").
2. **Interactive Demo Modal**:
   - Clicking "Watch 1-Min Demo 🎬" launches a sleek glassmorphic modal with an interactive tabbed workflow preview / video demo.
3. **Mobile Visitor Flow**:
   - Mobile users viewing in Safari / Chrome webview see a specialized card under hero CTAs: "Visiting on mobile? Send yourself a download link or star on GitHub to install on your computer later."
   - Clean thumb-friendly buttons (min 48px tap height, 100% width on narrow screens).
4. **Machine-Readable Route Pages**:
   - Navigation links in header/footer to `faq.html`, `vs-chatgpt.html`, and `privacy.html` with explicit comparative tables and Q&As.

## Open Risks
- Ensuring smooth 60fps animations on mobile devices without layout shifts (CLS).

## Artifacts Produced
- `docs/features/landing-page-update/ux-spec.md`

## Handoff to Next Agent
Handoff to **Frontend Agent** for implementation in `landing/index.html`, `landing/style.css`, and `landing/script.js`.

## Blockers
None.
