# Product Requirements Document (PRD): Landing Page Optimization & GEO/AIO Enhancements

## Summary
Overhaul the ProductOS landing page (`landing/index.html` and related files in `landing/`) to fix the zero-second engagement drop-off, optimize for Generative Engine Optimization (GEO/AIO), streamline above-the-fold hero content, introduce interactive visual previews, add mobile quick-save fallbacks, and implement structured machine-readable data pages.

## Decisions Made
1. **Hero Section Redesign**:
   - Change main headline to: `"The Local-First AI Command Center for Product Managers"`
   - Shorten sub-headline to 2 crisp sentences: `"ProductOS is a free, open-source desktop app that keeps your PRDs, research, and AI chats organized by project. Connect Claude, GPT-4, or local Ollama — with total data privacy."`
   - Implement side-by-side CTA buttons directly below text:
     - Primary: Solid accent `Download Desktop App (Mac / Win)`
     - Secondary: Outline/Ghost `View on GitHub`; keep `Watch 1-Min Demo 🎬` hidden until an approved ProductOS walkthrough URL is available.
2. **Hero Visual & Interactive Preview**:
   - Replace the static visual with an interactive preview card featuring clear workflow tabs (Drag & Drop Notes -> Local AI PRD -> Multi-Model Comparison).
   - Do not ship placeholder video embeds. If a ProductOS walkthrough is added later, expose the modal only with the approved URL and provide an inline muted video/GIF fallback for blocked webviews or playback failure.
   - Apply enhanced contrast/brightness filters to app UI container so text in screenshots stands out.
3. **Mobile Visitor Fallback**:
   - Add mobile detection banner with an explicit `Copy Download Link` action that copies `https://github.com/AIResearchFactory/productOS/releases/latest`; if clipboard access is blocked, display the URL for manual copy.
4. **GEO & AIO Optimization**:
   - Add expanded `SoftwareApplication` JSON-LD schema with complete metadata in `<head>`.
   - Add `FAQPage` JSON-LD schema with explicit questions & answers.
   - Create machine-readable HTML routes in `landing/`:
     - `landing/faq.html` (`https://productos-app.site/faq.html`)
     - `landing/compare.html` (`https://productos-app.site/compare.html`; `landing/vs-chatgpt.html` redirects here as a legacy alias)
     - `landing/data-ownership.html` (`https://productos-app.site/data-ownership.html`; `landing/privacy.html` redirects here as a legacy alias)

## Open Risks
- Mobile webviews from LinkedIn/Reddit may restrict video popups; keep video CTAs disabled until an approved walkthrough and inline muted video/GIF fallback pass QA.
- Clipboard APIs may be blocked in some mobile webviews; display the release URL for manual copy when both Clipboard API and `execCommand('copy')` fail.

## Artifacts Produced
- `docs/features/landing-page-update/prd.md`

## Handoff to Next Agent
Handoff to **UX Agent** to design screen states, mobile webview flow, and CTA interaction models.

## Blockers
None.
