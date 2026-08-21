# UX Specification: Robust & Brand-Aware Presentation Engine

## 1. User Flows & Screen States

### Flow A: Managing Project Brand Guidelines & Sample Decks
1. User navigates to **Project Settings** $\rightarrow$ **Brand Guidelines & Templates**.
2. User configures:
   - **Default Theme**: Pre-selected **Modern Dark Slate** (`#0F172A` background, `#06B6D4` cyan accent, `#10B981` emerald accent).
   - **Custom Color Palette**: Primary, Secondary, Accent, Dark Background, Light Background color pickers.
   - **Typography**: Heading Font & Body Font selection dropdowns (Inter, Roboto, Helvetica Neue, IBM Plex Sans).
   - **Logo**: SVG/PNG logo upload for slide headers/footers.
   - **Sample / Template Deck**: File dropzone accepting `.pptx` (Sample Deck) or `.potx` (Master Template).
3. User clicks **Save Brand Guidelines**.

### Flow B: Previewing & Customizing Slide Layouts
1. User opens a document / presentation workspace.
2. In the **Slide Layout Editor**:
   - Each slide is displayed as a visual preview card.
   - Auto-detected layout indicator is shown (e.g. `Bento Cards`, `Executive Split`, `High-Impact Hero Statistics`, `Timeline Flow`).
   - Visual Layout dropdown allows user to select or override layout type per slide.
3. User clicks **Export to PPTX**:
   - Modal allows choice between:
     - **Modern Dark Programmatic Engine** (Default, native shapes & layout rules).
     - **Uploaded Sample Deck / Template Engine** (Uses project's `.pptx` or `.potx` deck).
   - Progress feedback while presentation is assembled and downloaded.

---

## 2. Screen States

| Component / Screen | Empty State | Loading State | Success State | Error State |
|---|---|---|---|---|
| **Brand Settings Panel** | Defaults pre-filled with Modern Dark Slate palette (`#0F172A` / `#06B6D4`). | Skeleton loader for logo & font dropdowns. | Green toast: "Brand guidelines & sample deck saved". | Alert banner for invalid file format or corrupted upload. |
| **Slide Layout Editor** | "No slides detected. Add `#` titles to your markdown." | Spinner while parsing slide structure. | Grid of interactive slide layout cards including High-Impact Hero Statistics. | Alert banner with markdown parsing hints. |
| **PPTX Export Modal** | N/A | "Sanitizing brand colors & building OOXML..." with spinner. | "Presentation downloaded successfully!" | Error callout detailing specific formatting error. |

---

## 3. Accessibility & Interaction Specs
- **Color Contrast**: Dark background slides enforce light text (`#F8FAFC`); light cards enforce dark text (`#0F172A`).
- **High-Impact Hero Layout**: Enforces min 72pt font size for primary metric digits, scaling dynamically for longer numbers.
- **Keyboard Navigation**: Layout selector and brand color pickers fully accessible via Tab and Arrow keys.
