# QA Strategy Plan: Robust & Brand-Aware Presentation Engine

## 1. Risk-Based Test Matrix

| Priority | Test Focus | Description | Verification Method |
|---|---|---|---|
| **P0** | Hex Color Sanitization | Verify `#` prefixed hex strings (e.g., `#0F172A`, `#06B6D4`) never reach `pptxgenjs` raw API. | Unit test (`tests/pptx-safeguards.test.mjs`) |
| **P0** | Options Object Mutation | Verify option objects passed to `addShape`/`addText` are not mutated across iterations. | Unit test |
| **P0** | Chart Axis Safety | Verify native chart generation sets both `valAxes` and `catAxes` to prevent PowerPoint crash. | Unit test |
| **P0** | Sample `.pptx`/`.potx` XML Duplication | Verify backend template engine unzips sample `.pptx`/`.potx`, duplicates slide XMLs, replaces `<a:t>` tags, and re-zips cleanly. | Backend test (`tests/pptx-template-service.test.mjs`) |
| **P1** | Modern Dark Brand Theme | Verify default project theme applies Slate (`#0F172A`) and Cyan (`#06B6D4`) with high-contrast text. | Unit + Integration test |
| **P1** | High-Impact Hero Numbers Layout | Verify giant number font scaling (72pt+) and metric card bounds. | Unit test |

---

## 2. Functional Scenarios
1. **Hex Clean Test**: Input `#06B6D4` $\rightarrow$ output `"06B6D4"`. Input invalid string $\rightarrow$ fallback default (`"0F172A"`).
2. **Hero Statistics Test**: Metric slide with string `$4.2MARR (+45% YoY)` dynamically scales font to fit without wrapping onto title area.
3. **Stacked Chart Label Position Test**: Ensure `dataLabelPosition` is restricted to `ctr`, `inEnd`, `inBase` for stacked bar/column charts.
4. **Sample `.pptx` Template Export Test**: Upload a sample `company_deck.pptx` $\rightarrow$ trigger template export $\rightarrow$ verify output presentation retains master background, layouts, and fills placeholders with markdown content.
