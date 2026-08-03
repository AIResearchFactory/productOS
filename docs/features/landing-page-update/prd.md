# Product Requirements Document (PRD): Landing Page Optimization & GEO/AIO Enhancements

## Summary
Overhaul the ProductOS landing page (`landing/index.html` and related files in `landing/`) to fix the zero-second engagement drop-off, optimize for Generative Engine Optimization (GEO/AIO), streamline above-the-fold hero content, introduce interactive visual previews, add mobile quick-save fallbacks, and implement structured machine-readable data pages.

## Decisions Made
1. **Hero Section Redesign**:
   - Change main headline to: `"The Local-First AI Command Center for Product Managers"`
   - Shorten sub-headline to 2 crisp sentences: `"ProductOS is a free, open-source desktop app that keeps your PRDs, research, and AI chats organized by project. Connect Claude, GPT-4, or local Ollama — with total data privacy."`
   - Implement side-by-side CTA buttons directly below text:
     - Primary: Solid accent `Download Desktop App (Mac / Win)`
     - Secondary: Outline/Ghost `Watch 1-Min Demo 🎬` & `View on GitHub`
2. **Hero Visual & Interactive Preview**:
   - Replace static visual with an interactive preview card & video/demo modal launcher featuring clear workflow tabs (Drag & Drop Notes -> Local AI PRD -> Multi-Model Comparison).
   - Apply enhanced contrast/brightness filters to app UI container so text in screenshots stands out.
3. **Mobile Visitor Fallback**:
   - Add mobile detection banner/input: `"On mobile? Enter your email to send yourself a download link for later"` with email save input or quick link copy fallback.
4. **GEO & AIO Optimization**:
   - Add expanded `SoftwareApplication` JSON-LD schema with complete metadata in `<head>`.
   - Add `FAQPage` JSON-LD schema with explicit questions & answers.
   - Create machine-readable HTML routes in `landing/`:
     - `landing/faq.html` (`/docs/faq`)
     - `landing/vs-chatgpt.html` (`/vs/chatgpt`)
     - `landing/privacy.html` (`/features/privacy`)

## Open Risks
- Mobile webviews from LinkedIn/Reddit might restrict modal video popups if blocked by sandbox. Solution: inline muted video/GIF fallback.
- Local email save fallback requires zero-backend fallback (e.g. `mailto:` link generation or localStorage copy confirmation).

## Artifacts Produced
- `docs/features/landing-page-update/prd.md`

## Handoff to Next Agent
Handoff to **UX Agent** to design screen states, mobile webview flow, and CTA interaction models.

## Blockers
None.
