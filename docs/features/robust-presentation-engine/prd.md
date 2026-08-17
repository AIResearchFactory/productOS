# Product Requirements Document (PRD): Robust & Brand-Aware Presentation Engine (V2)

## 1. Problem Statement
ProductOS users require high-quality, professional slide deck exports (PPTX) generated from markdown research reports, initiatives, and roadmaps. Currently, slide export uses basic `pptxgenjs` layouts with minimal brand customizability and lacks the visual polish, grid structure, and technical safeguards found in modern design systems and advanced AI presentation skills (such as Anthropic's PPTX Skill).

Key pain points:
- **Visual Quality & Layout Variety**: Decks lack modern corporate grid structures, bento cards, executive summary splits, high-impact hero statistics callouts, or native styled charts.
- **Brand Consistency**: Users cannot define rich, project-specific brand guidelines (logo, typography, primary/accent/dark palettes, card border styles) that default to a sleek modern dark theme.
- **PPTX Generation Corruption Footguns**: `pptxgenjs` has edge cases (e.g., `#` in hex colors, option object EMU mutation, invalid stacked chart label positions, negative shadow offsets) that can corrupt output files.
- **Lack of Custom Sample / Template Deck Support**: Enterprise users cannot upload sample `.pptx` presentation decks or `.potx` templates for exact master layout reuse and slide duplication.

## 2. Goals & Success Metrics
- **Visual Polish**: 8+ distinct high-impact slide layouts (Hero Title, Executive Split, 2/3/4 Bento Grid Cards, High-Impact Hero Statistics/Metrics Spotlight, Timeline Flow, Comparison Matrix, Native Brand Charts).
- **Brand System Integration**: 100% adherence to project-level custom brand guidelines, defaulting to a sleek modern dark theme (`#0F172A` Slate / `#06B6D4` Cyan accent / `#10B981` Emerald accent).
- **Zero Corruption**: 100% pass rate on PPTX file structural validation (hex sanitization, cloned options objects, safe chart axes).
- **Full Template & Sample Deck Engine**: Comprehensive support for both dynamic programmatic `pptxgenjs` generation AND user-uploaded `.pptx` sample decks or `.potx` master templates.

---

## 3. Architecture & Engine Options

| Evaluation Criteria | Enhanced Programmatic Engine | Sample Deck & Template Engine (.pptx / .potx) | Unified Hybrid Solution (ProductOS Standard) |
|---|---|---|---|
| **Visual Quality** | High (Bento cards, Modern Dark design system) | Perfect (Designer sample deck / template) | **Exceptional (HTML Preview + Programmatic / Sample Deck)** |
| **PowerPoint Editability** | 100% Native Editable Text & Shapes | 100% Native Editable Text & Shapes | **100% Native Editable Text & Shapes** |
| **Brand Flexibility** | High (Dynamic Schema) | Absolute (Corporate Sample Deck) | **Unlimited** |
| **Tech Complexity** | Low / Medium | Medium (Node backend zip/XML service) | **Modular & Scalable** |
| **Status** | **Core Default Engine** | **Included in Scope (Full `.pptx`/`.potx`)** | **SELECTED UNIFIED SOLUTION** |

---

## 4. Prioritized Feature Breakdown (Single Unified Release)

### A. Core Engine & Brand System
1. **`ProjectBrandConfig` Schema**: Expand project metadata with primary, secondary, accent, dark background, light background, heading/body fonts, logo URL, and card styling.
   - **Default Theme**: Modern Dark Theme (`#0F172A` Slate Dark, `#06B6D4` Cyan Accent, `#10B981` Emerald Accent, `#F8FAFC` Text).
2. **Anthropic PPTX Footgun Safeguard Layer**:
   - Automatic Hex Color Sanitizer (strip `#`, validate hex, fallback safe).
   - Options object deep cloner (prevents EMU mutation across elements).
   - Shadow & list spacing normalization (`paraSpaceAfter`, `margin: 0`, positive shadow offsets).
   - Native Chart Safeguard (explicit `valAxes` + `catAxes` for combos, safe label positioning for stacked charts).
3. **Generalized Modern Dark Layout System**:
   - **High-Impact Hero Statistics / Metrics Spotlight**: Giant 72pt-96pt callout numbers, percentage metrics, stat cards.
   - **Executive Split**: 40/60 asymmetrical panel with dark slate / cyan contrast.
   - **Bento Multi-Column Cards**: 2, 3, or 4 columns with automatic card bounds math and soft dark card background (`#1E293B`).
   - **Timeline / Process Flow**: Horizontal timeline with node markers.
   - **Comparison Grid**: 2-card comparison with vertical dividing line.

### B. Sample Deck & `.potx` / `.pptx` Template Manipulation Engine
1. **Sample Deck & Template Upload (`.pptx` & `.potx`)**:
   - Node backend API endpoint to upload and store sample `.pptx` or `.potx` files per project.
   - OOXML Unpack & Duplication Service (`node-backend/lib/services/pptx-template-service.mjs`).
   - Duplicates slide XML files (`ppt/slides/slideN.xml`) and layout relationships based on parsed document structure.
   - Injects parsed text, bullets, and numbers into template placeholder shapes (`<a:t>`).
   - Runs relationship cleaner (`clean`) and zips output presentation.

---

## 5. Scope Boundaries

### In Scope
- Expanding project settings to include Brand Guidelines editor (with Modern Dark default).
- Refactoring `src/lib/pptxExport.ts` into modular layout builders and safeguard utilities.
- Node.js backend template service for uploading `.pptx` / `.potx` files, unzipping, slide duplication, text injection, and re-zipping.
- High-Impact Hero Statistics / Metrics layout for highlighting numbers & data points.

### Out of Scope
- Converting slides to MP4 video animations.
- Legacy binary PowerPoint files (`.ppt` pre-2007).

---

## 6. Acceptance Criteria (Testable)
- [ ] New projects automatically inherit the Modern Dark default theme (`#0F172A` background, `#06B6D4` cyan accent, `#F8FAFC` text) if no custom brand settings exist.
- [ ] Exporting a PPTX with hex colors containing `#` (e.g. `#06B6D4`) automatically sanitizes to `"06B6D4"` without throwing or corrupting the file.
- [ ] High-impact statistics slides display giant numbers (72pt+) with non-overlapping captions and high contrast.
- [ ] Users can upload a sample `.pptx` or `.potx` template deck in project settings; exporting with template option duplicates template slides and injects text natively into PowerPoint placeholders.
- [ ] Native PPTX charts generated with `addChart` include both category and value axes options to prevent PowerPoint missing axis errors.
