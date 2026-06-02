# PRD: Workspace Navigation Redesign

**Feature ID:** `workspace-navigation-redesign`
**Status:** Draft
**Author:** Product/Design Agent
**Date:** 2026-06-02

---

## 1. Problem Statement

User feedback reveals several friction points in the ProductOS workspace navigation:

1. **Product switching is split across two locations** (TopBar dropdown + Products sidebar tab) creating confusion about the canonical way to switch. The dropdown format doesn't scale well for users with many products.
2. **The Outputs tab duplicates the artifact tree** already visible in the sidebar file view, yet it's the only place to create new output types or import markdown — critical actions are hidden.
3. **Create File and Import Document** are buried in context menus (right-click) and use inconsistent naming ("Create File" vs "Create Output", "Import Document" vs "Import Markdown").
4. **The Show Chat button** competes for space in the document tab bar and opens from the left (splitting the editor view), when it could live in the top navigation and open as a right sidebar — a more natural position for an assistant panel.

## 2. Target User / Persona

**Primary:** Product Managers using ProductOS daily who manage 2-10+ products, frequently create files/artifacts, and rely on the Copilot assistant.

**Secondary:** Team leads reviewing product outputs across multiple workspaces.

## 3. Success Metrics

| Metric | Baseline | Target |
|--------|----------|--------|
| Time to switch products | ~3 clicks via sidebar, ~2 via dropdown | 1-2 clicks via TopBar panel |
| Create/Import action discoverability | Hidden in context menu / Outputs-only | Visible primary buttons |
| Chat panel access | Scan editor toolbar | Persistent TopBar icon |
| Navigation items requiring explanation | 3 (Products vs Outputs confusion) | 0 |

## 4. User Stories

### US-1: Product Switcher Panel
> **As a** PM with multiple products,
> **I want** a dedicated product switcher panel accessible from the TopBar,
> **So that** I can quickly browse all my products, see their status, and switch or create new ones without navigating the sidebar.

**Acceptance Criteria:**
- [ ] Clicking the product name/chevron in the TopBar opens a slide-down panel (not a dropdown)
- [ ] Panel lists all products with name, description snippet, and file/artifact counts
- [ ] Panel has a search/filter field for 5+ products
- [ ] Panel has a prominent "New Product" button
- [ ] Clicking a product switches the active product and closes the panel
- [ ] The panel can be dismissed with Escape, clicking outside, or the close button
- [ ] Active product is visually highlighted in the list

### US-2: Product Home in Sidebar
> **As a** user who just selected a product,
> **I want** a "Home" button at the top of the left sidebar,
> **So that** I can always return to the product dashboard that shows stats, recommended tasks, and recent files.

**Acceptance Criteria:**
- [ ] When a product is active, a "Home" icon-button appears as the first item in the sidebar file tree area
- [ ] Clicking Home opens the ProductHome page in the main panel
- [ ] The Home button uses a House/Home icon consistent with the icon system
- [ ] The existing artifact tree below Home is preserved as-is

### US-3: Unified Create & Import Actions
> **As a** user working in a product,
> **I want** visible Create and Import buttons above the file list,
> **So that** I don't have to right-click or navigate to the Outputs tab to add new content.

**Acceptance Criteria:**
- [ ] A "Create" split-button is visible above the file tree (default: create regular file)
- [ ] The split-button chevron opens a menu to select a specific output type (Roadmap, PRD, etc.)
- [ ] An "Import" button is visible next to Create (imports document, markdown, PDF)
- [ ] The Outputs sidebar tab may be removed if these actions are fully covered
- [ ] Context menu "Add File" and "Import Document" remain as secondary access paths
- [ ] Terminology is unified: "Create" (not "Add File" vs "New Artifact") and "Import" (not "Import Document" vs "Import Markdown")

### US-4: Chat Button in TopBar (Right Sidebar)
> **As a** user who needs the AI assistant,
> **I want** the chat toggle in the TopBar navigation,
> **So that** it's always discoverable and opens as a right sidebar, leaving more room for document tabs.

**Acceptance Criteria:**
- [ ] A Copilot/Chat icon-button is placed in the TopBar right section
- [ ] Clicking it opens the ChatPanel as a right sidebar (instead of left)
- [ ] The Chat button shows a visual indicator when there's an active conversation
- [ ] The "Show Chat" buttons in the editor tab bar and FAB are removed
- [ ] Chat panel is resizable from the left edge
- [ ] All existing chat functionality (focus mode, peek file, etc.) continues to work

## 5. Scope

### In Scope
- TopBar product switcher panel component
- Sidebar Home button for active product
- Create split-button + Import button above file tree
- Chat toggle relocated to TopBar → right sidebar
- Remove/deprecate Outputs sidebar tab
- Unified action naming

### Out of Scope
- Search/command palette (Cmd+K) — separate feature
- Mobile bottom navigation — separate feature
- Workflow or Skills sidebar changes
- Backend API changes

## 6. Edge Cases

| Case | Expected Behavior |
|------|-------------------|
| 0 products exist | Product switcher panel shows empty state + prominent "Create your first product" CTA |
| 50+ products | Panel shows search bar at top, virtual scroll for list |
| Active product deleted | Switch to next product or show Welcome page |
| Chat already open + user clicks TopBar chat | Chat closes (toggle behavior) |
| Narrow viewport (< 768px) | Product switcher becomes full-width overlay; Chat opens as full-width overlay |
| Keyboard-only user | All new components are keyboard-navigable with visible focus indicators |

## 7. Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| Existing TopBar component | Internal | Ready to modify |
| Existing Sidebar component | Internal | Ready to modify |
| Existing MainPanel component | Internal | Ready to modify |
| Existing ChatPanel component | Internal | Ready to modify |
| No new backend APIs needed | Backend | N/A |

## 8. Implementation Slices

### MVP (v1)
1. Product Switcher Panel in TopBar (replaces dropdown)
2. Home button in sidebar when product is active
3. Create + Import buttons above file tree
4. Chat toggle moved to TopBar (right sidebar)
5. Remove "Show Chat" from editor tab bar

### V2 (follow-up)
1. Product search/filter in switcher panel
2. Remove Outputs sidebar tab entirely (once create/import is stable)
3. Product favorites/pinning
4. Recent products section in switcher panel

## 9. API/Contract Assumptions

- No new backend endpoints required for this feature
- Product switching continues to use `appApi.getProjectFiles()`, `appApi.listArtifacts()`, etc.
- Chat panel rendering is purely a frontend layout change
- Create/Import actions reuse existing `onAddFileToProject`, `onCreateArtifact`, `onImportDocument` handlers

---

## Handoff Contract

| Field | Value |
|-------|-------|
| **Summary** | Four UI improvements based on user feedback: TopBar product switcher panel, sidebar Home button, unified Create/Import actions, chat moved to right sidebar |
| **Decisions made** | Panel > dropdown for product switching; right sidebar > left for chat; Outputs tab deprecated in v2 |
| **Open risks** | Chat panel swap from left to right may need careful attention to resize handle direction; removing Outputs tab requires all functionality to be covered by Create/Import buttons |
| **Artifacts produced** | This PRD (`prd.md`) |
| **Handoff to next agent** | UX Agent — to define interaction flows, states, and accessibility specs |
| **Blockers** | None |
