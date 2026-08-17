# Frontend Plan: Robust & Brand-Aware Presentation Engine

## 1. Architecture Overview
Refactor presentation generation into modular typescript modules in `src/lib/presentation/`:
- `src/lib/presentation/pptxSafeguards.ts`: Sanitization, option object cloning, chart option safety, color utilities.
- `src/lib/presentation/brandSystem.ts`: Project Brand Guidelines types, Modern Dark Theme defaults (`#0F172A`, `#06B6D4`, `#10B981`), and contrast rules.
- `src/lib/presentation/layouts/`: Modular slide layout generators:
  - `spotlightLayout.ts`: High-Impact Hero Statistics & Key Metrics.
  - `splitLayout.ts`: 40/60 Executive Split.
  - `bentoLayout.ts`: 2/3/4 Bento Grid Cards.
  - `timelineLayout.ts`: Horizontal Timeline Flow.
  - `comparisonLayout.ts`: Side-by-side comparison matrix.
  - `chartLayout.ts`: Native brand-styled charts.
- `src/lib/presentation/pptxExportV2.ts`: Unified entry point supporting both programmatic PPTX export and sample deck/template backend export.

---

## 2. Component Updates

### A. `BrandSettingsModal.tsx` / Project Settings UI
- Add Brand Guidelines & Sample Decks tab in Project Settings.
- Color pickers for `primary`, `secondary`, `accent`, `backgroundDark`, `backgroundLight`.
- Default pre-set button: "Reset to Modern Dark Theme".
- File uploader for `.pptx` (Sample Deck) or `.potx` (Master Template).

### B. `SlideLayoutEditor.tsx`
- Add layout options: `spotlight` (High-Impact Hero Statistics), `split`, `columns` (Bento Cards), `timeline`, `comparison`, `section`, `standard`.
- Live visual content preview with metric highlight badges.

### C. `pptxSafeguards.ts` Implementation
```ts
export function sanitizeHexColor(color?: string, defaultColor = "0F172A"): string {
  if (!color) return defaultColor;
  let cleaned = color.trim().replace(/^#/, '');
  if (cleaned.length === 3) {
    cleaned = cleaned.split('').map(c => c + c).join('');
  }
  if (!/^[0-9A-Fa-f]{6}$/.test(cleaned)) {
    return defaultColor;
  }
  return cleaned.toUpperCase();
}

export function deepCloneOptions<T>(opts: T): T {
  return JSON.parse(JSON.stringify(opts));
}
```

---

## 3. Responsive & Edge Case Behavior
- **Text Box Padding**: Enforce `margin: 0` on aligned text boxes to align with shapes & borders.
- **Hero Statistics Font Scaling**: Automatically scale metric font size (72pt to 36pt) based on character count so numbers never break onto unexpected lines.
- **Bullet Interleaving**: Preserve exact interleaved order of body paragraphs, bullets, and sub-bullets.
