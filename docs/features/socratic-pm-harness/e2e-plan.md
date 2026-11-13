# E2E Test Plan: Socratic PM Intelligence (M1)

> **Feature**: `socratic-pm-harness`  
> **Milestone**: M1 (P0: Socratic Grilling Engine + On-Demand Critic Board)  
> **Pipeline Stage**: E2E Test Agent $\rightarrow$ Ready for Implementation & CI Execution  
> **Reference Specs**: [qa-plan.md](./qa-plan.md) &bull; [unit-test-plan.md](./unit-test-plan.md) &bull; [helpers.ts](../../../e2e/helpers.ts)

---

## 1. Executive Summary & Test File Inventory

This plan specifies the Playwright End-to-End (E2E) test suite for **Milestone 1 (P0)** of Socratic PM Intelligence.
It validates the full user journey:
$$\text{Prompt in Chat} \longrightarrow \text{Socratic Grilling} \longrightarrow \text{Artifact Generation} \longrightarrow \text{Critic Quality Audit} \longrightarrow \text{Apply Fix} \longrightarrow \text{PDF \& DOCX Export}$$

### Test Files:
```
e2e/
├── socratic-pm-harness.spec.ts     [NEW] Primary E2E test suite for Socratic & Critic workflows
└── socratic-accessibility.spec.ts  [NEW] Keyboard navigation & axe-core accessibility tests
```

---

## 2. Detailed E2E Scenarios (`e2e/socratic-pm-harness.spec.ts`)

### Scenario 1: Complete Authoring-to-Export Lifecycle (Happy Path)
```typescript
test('complete journey: prompt -> grill -> generate -> critic audit -> apply fix -> export PDF', async ({ page }) => {
  // 1. Navigate to Project Workspace
  await skipSetupAndReach(page);

  // 2. Prompt in Chat for a new PRD
  const chatInput = page.getByTestId('chat-input');
  await chatInput.fill('Create a PRD for Slack alerts integration');
  await page.getByTestId('chat-send-btn').click();

  // 3. Verify Socratic Proposal Card appears
  const grillCard = page.getByTestId('socratic-grill-card');
  await expect(grillCard).toBeVisible({ timeout: 15000 });

  // 4. Opt into Grilling
  await page.getByTestId('btn-grill-me').click();

  // 5. Answer Question 1 via Quick Chip
  const chipRateLimit = page.getByTestId('quick-chip-rate-limit');
  await expect(chipRateLimit).toBeVisible();
  await chipRateLimit.click();

  // 6. Answer Question 2 via Custom Text Input
  const socraticInput = page.getByTestId('socratic-custom-input');
  await socraticInput.fill('Alert engineering team after 3 consecutive webhook drops');
  await socraticInput.press('Enter');

  // 7. Verify PRD Generation & Editor Mount
  const markdownEditor = page.getByTestId('markdown-editor');
  await expect(markdownEditor).toBeVisible({ timeout: 20000 });
  await expect(markdownEditor).toContainText('Slack alerts integration');

  // 8. Run Adversarial Quality Check Audit
  const qualityCheckBtn = page.getByTestId('btn-quality-check');
  await qualityCheckBtn.click();

  // 9. Verify Critic Review Drawer Mounts with Findings
  const criticDrawer = page.getByTestId('critic-review-drawer');
  await expect(criticDrawer).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('critic-finding-card')).toHaveCount(3);

  // 10. Apply Fix from Telemetry Guardian
  const applyFixBtn = page.getByTestId('btn-apply-fix-telemetry_guardian');
  await applyFixBtn.click();
  await expect(page.getByText('Fix Applied')).toBeVisible();

  // 11. Trigger PDF Export & Validate Download
  const exportMenu = page.getByTestId('btn-export-menu');
  await exportMenu.click();
  
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('btn-export-pdf').click()
  ]);

  expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
});
```

---

### Scenario 2: Immediate Bypass & DOCX Export
```typescript
test('bypass grilling -> generate immediately -> dismiss finding -> export DOCX', async ({ page }) => {
  await skipSetupAndReach(page);

  // Prompt Roadmap
  await page.getByTestId('chat-input').fill('Create our Q3 Infrastructure Roadmap');
  await page.getByTestId('chat-send-btn').click();

  // Click [Generate Immediately] Bypass
  const bypassBtn = page.getByTestId('btn-generate-immediately');
  await expect(bypassBtn).toBeVisible({ timeout: 15000 });
  await bypassBtn.click();

  // Verify Roadmap renders with Assumptions section
  const markdownEditor = page.getByTestId('markdown-editor');
  await expect(markdownEditor).toBeVisible({ timeout: 20000 });
  await expect(markdownEditor).toContainText('## Assumptions & Defaults');

  // Trigger Audit via Shortcut (Cmd+Shift+Q / Ctrl+Shift+Q)
  const isMac = process.platform === 'darwin';
  await page.keyboard.press(isMac ? 'Meta+Shift+Q' : 'Control+Shift+Q');

  const criticDrawer = page.getByTestId('critic-review-drawer');
  await expect(criticDrawer).toBeVisible({ timeout: 10000 });

  // Dismiss Tone Inspector finding
  const dismissBtn = page.getByTestId('btn-dismiss-finding-tone_inspector');
  await dismissBtn.click();

  // Export as DOCX
  await page.getByTestId('btn-export-menu').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('btn-export-docx').click()
  ]);

  expect(download.suggestedFilename()).toMatch(/\.docx$/i);
});
```

---

## 3. Accessibility E2E Scenarios (`e2e/socratic-accessibility.spec.ts`)

```typescript
test('accessibility: full keyboard traversal and zero axe-core violations', async ({ page }) => {
  await skipSetupAndReach(page);

  // Run initial axe-core audit
  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);

  // Open Critic Drawer via Keyboard Shortcut
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+Q' : 'Control+Shift+Q');
  
  // Verify focus lands on first interactive finding element
  await expect(page.getByTestId('critic-finding-card').first()).toBeFocused();

  // Press Escape to dismiss drawer
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('critic-review-drawer')).not.toBeVisible();
});
```

---

## 4. Test Stability & Flakiness Mitigation Rules

1. **Strict Selector Policy**: Use only `data-testid` selectors (e.g. `getByTestId('socratic-grill-card')`) to eliminate brittle CSS/class dependencies.
2. **Deterministic Mock Backend in CI**: Use mock provider mode during E2E runs to keep end-to-end execution fast ($<12\text{ s}$) and decouple tests from external LLM API rate limits.
3. **No Arbitrary `page.waitForTimeout()`**: Rely exclusively on Playwright web-first assertions (`toBeVisible({ timeout: ... })`, `waitForEvent('download')`).

---

## 5. Stage Gate Handoff Contract (E2E $\rightarrow$ DevOps Release Plan)

### Summary
Complete Playwright E2E test plan specified with happy paths, bypass flows, keyboard navigation, axe-core scans, and dual export format validation (**PDF** and **DOCX**).

### Artifacts Produced
- `docs/features/socratic-pm-harness/e2e-plan.md`

### Handoff to Next Agent
- **DevOps Agent** (for `release-plan.md`)

### Blockers
- None. Ready for DevOps release planning.
