# UX Spec: Workspace Navigation Redesign

**Feature ID:** `workspace-navigation-redesign`
**Status:** Draft
**Author:** UX Agent
**Date:** 2026-06-02
**Input:** [PRD](./prd.md)

---

## 1. Primary User Flows

### Flow A: Product Switching via TopBar Panel

```
User clicks product name in TopBar
  → Panel slides down from TopBar (280px height, full TopBar width)
  → Panel shows: Search bar + Product grid/list + "New Product" button
  → User clicks a product
    → Panel animates closed (150ms ease-out)
    → Active product updates
    → Sidebar shows Home + artifact tree for new product
    → Main panel opens ProductHome
  → OR User clicks "New Product"
    → Panel closes
    → New Product settings form opens in main panel
  → OR User presses Escape / clicks outside
    → Panel closes, no change
```

### Flow B: Navigating to Product Home

```
User selects a product (from switcher or sidebar)
  → Sidebar file tree shows:
    ┌─────────────────────┐
    │ 🏠 Home             │  ← NEW: always first item
    ├─────────────────────┤
    │ ▸ Roadmaps (2)      │  ← artifact tree (existing)
    │ ▸ PRDs (3)           │
    │ ▸ User Stories (5)   │
    ├─────────────────────┤
    │ 📄 meeting-notes.md  │  ← regular files (existing)
    │ 📄 research.md       │
    │ 💬 chat-session-1    │
    └─────────────────────┘
  → User clicks Home
    → ProductHome page renders in main panel
    → Home item is highlighted as active
```

### Flow C: Create File / Output Type

```
User sees two action buttons above the file tree:
  ┌──────────────────────────────────┐
  │  [+ Create ▾]    [↓ Import]     │
  └──────────────────────────────────┘

→ Click "Create" button directly:
    → Creates a new blank file (FileFormDialog opens)
→ Click the "▾" chevron on Create:
    → Small dropdown menu appears:
      ┌──────────────────────────┐
      │  📄 New File (default)   │
      │  ─────────────────────── │
      │  🧭 Roadmap             │
      │  👁 Product Vision       │
      │  📋 PRD                  │
      │  🚀 Initiative           │
      │  👥 User Story           │
      │  💡 Insight              │
      │  📊 Presentation         │
      │  ⚔️ Competitive Research │
      │  📝 One Pager            │
      │  📰 PR-FAQ               │
      └──────────────────────────┘
    → Selecting an output type opens CreateArtifactDialog

→ Click "Import" button:
    → Opens native file picker (md, txt, docx, pdf)
    → File is imported into the active project
```

### Flow D: Chat Toggle from TopBar (Right Sidebar)

```
User sees Copilot icon-button in TopBar right section:
  ┌─────────────────────────────────────────────────────────┐
  │ ProductOS │ Active Product ▾  │      [🔍] [💬] [⚙] [🌙] │
  └─────────────────────────────────────────────────────────┘

→ Click Copilot button:
    → Chat panel slides in from the RIGHT edge (300ms ease-out)
    → Chat panel width: saved preference or default 540px
    → Editor area shrinks from the right
    → TopBar button gets active state indicator
→ Click again:
    → Chat panel slides out to the right (200ms ease-in)
    → Editor area expands to full width
```

---

## 2. Screen States

### Product Switcher Panel

| State | Description | Visual |
|-------|-------------|--------|
| **Default (closed)** | TopBar shows active product name + chevron-down | Compact, single line |
| **Open** | Panel slides down, overlays content below TopBar | White/card bg, shadow-xl, 280-400px height |
| **Loading** | Products are being fetched | Skeleton grid (3 items) |
| **Empty** | No products exist | Illustration + "Create your first product" CTA |
| **Populated (< 6)** | Few products | Grid layout, 2 columns, no search |
| **Populated (≥ 6)** | Many products | Search bar visible + scrollable list |
| **Search active** | User typed in search | Filtered list, "No results" empty state |
| **Error** | Products failed to load | Error message + retry button |

### Sidebar (Product Active)

| State | Description |
|-------|-------------|
| **Home active** | Home button highlighted, ProductHome shown in main panel |
| **File active** | A regular file is selected and open in editor |
| **Artifact active** | An artifact from the tree is selected |
| **Empty project** | Home + "No files yet" message + Create/Import buttons |
| **Collapsed sidebar** | Icon rail: Home icon visible, Create/Import buttons hidden |

### Create Split-Button

| State | Description |
|-------|-------------|
| **Default** | "Create" button with small chevron on the right |
| **Hover** | Subtle background highlight on the main button area |
| **Chevron hover** | Chevron area highlights independently |
| **Menu open** | Dropdown list of output types below the chevron |
| **Disabled** | No active project — both buttons are disabled with tooltip |

### Chat Panel (Right Sidebar)

| State | Description |
|-------|-------------|
| **Hidden** | TopBar button is in default state, no panel visible |
| **Open** | Right sidebar with chat, resize handle on left edge |
| **Active conversation** | Small dot indicator on TopBar button |
| **Chat-focused mode** | Full width centered chat (existing behavior) |
| **Resizing** | Left resize handle is highlighted |

---

## 3. Accessibility Requirements

### Keyboard Navigation

| Component | Keyboard Behavior |
|-----------|-------------------|
| **Product Switcher** | `Enter/Space` opens panel; `Escape` closes; `Arrow keys` navigate products; `Tab` cycles through search → products → New Product button |
| **Home Button** | Standard button focus; `Enter/Space` activates |
| **Create Split-Button** | `Enter/Space` on main area → create file; `Enter/Space` on chevron → open menu; `Arrow keys` in menu; `Escape` closes menu |
| **Import Button** | `Enter/Space` opens file picker |
| **Chat Toggle** | `Enter/Space` toggles; `Cmd/Ctrl+J` shortcut retained |

### ARIA Attributes

```
Product Switcher Panel:
  - Trigger: role="button", aria-expanded="true/false", aria-controls="product-panel"
  - Panel: role="dialog", aria-label="Switch product"
  - Product items: role="option", aria-selected="true" for active

Home Button:
  - role="button", aria-label="Product Home"
  - aria-current="page" when active

Create Split-Button:
  - Main button: role="button", aria-label="Create new file"
  - Chevron: role="button", aria-haspopup="menu", aria-expanded="true/false"
  - Menu: role="menu", items: role="menuitem"

Chat Toggle:
  - role="button", aria-label="Toggle Copilot chat"
  - aria-pressed="true/false"
```

### Focus Management

- Opening the product switcher panel → focus moves to search input (or first product if no search)
- Closing panel → focus returns to the trigger button
- Opening create menu → focus moves to first menu item
- Closing menu → focus returns to chevron button
- Opening chat panel → focus moves to chat input
- Closing chat panel → focus returns to chat toggle button

### Contrast & Visual

- All interactive elements meet WCAG AA (4.5:1 for text, 3:1 for large elements)
- Focus rings: 2px solid primary with 2px offset
- Active states clearly distinguishable from hover states
- Dark mode variants tested independently

---

## 4. Interaction Notes

### Product Switcher Panel

- **Animation:** Slide down from TopBar height (0→280px), 200ms ease-out. Content fades in at 100ms delay.
- **Backdrop:** Semi-transparent overlay (bg-black/20) behind panel, above content
- **Z-index:** Above sidebar (z-50), below modals (z-100)
- **Position:** Anchored below TopBar, full width of the main content area (not covering sidebar)
- **Search debounce:** 200ms for filtering products
- **Product card:** Shows name, description (1 line truncated), file count, artifact count

### Create Split-Button

- **Split behavior:** Two distinct click regions — main button (left 80%) and chevron (right 20%)
- **Visual split:** Subtle vertical border between main and chevron areas
- **Menu position:** Below the button, aligned to the left edge
- **Menu animation:** Scale from 0.95 + fade, 150ms
- **Menu dismiss:** Click outside, Escape, or selecting an item

### Chat Panel Relocation

- **Direction change:** Panel now opens from the RIGHT (was left)
- **Resize handle:** On the LEFT edge of the chat panel (was right)
- **Width persistence:** Same localStorage key, same min/max constraints
- **Layout flow:** `[Sidebar] [Editor/Content] [Chat Panel]` (was `[Sidebar] [Chat Panel] [Editor]`)
- **Transition:** 300ms ease-out open, 200ms ease-in close

### Validation & Transitions

- Product switching triggers full project reload (files, artifacts, workflows)
- Creating a file/artifact while no project is active shows a toast error
- All panels use `AnimatePresence` from framer-motion for enter/exit
- Reduced motion: panels appear/disappear instantly (no animation)

---

## 5. UI Copy Draft

### Product Switcher Panel

| Element | Copy |
|---------|------|
| Panel heading | "Your Products" |
| Search placeholder | "Search products…" |
| Empty state title | "No products yet" |
| Empty state description | "Create your first product to get started with ProductOS." |
| Empty state CTA | "New Product" |
| New Product button | "+ New Product" |
| Active product badge | "Active" |

### Sidebar

| Element | Copy |
|---------|------|
| Home button label | "Home" |
| Home tooltip | "Product Home" |
| Create button | "Create" |
| Create chevron tooltip | "Create output type…" |
| Import button | "Import" |
| Import tooltip | "Import document (md, docx, pdf)" |

### TopBar Chat Button

| Element | Copy |
|---------|------|
| Button tooltip | "Toggle Copilot" |
| Button aria-label | "Toggle Copilot chat" |

---

## 6. Handoff Annotations for FE Agent

### Component Hierarchy Changes

```
Workspace.tsx
├── MenuBar (unchanged)
├── TopBar.tsx
│   ├── Product Switcher Trigger (existing, modified)
│   ├── ProductSwitcherPanel.tsx [NEW]
│   │   ├── Search input
│   │   ├── Product grid/list
│   │   └── New Product button
│   ├── Chat Toggle Button [NEW — moved from MainPanel]
│   ├── Theme toggle (existing)
│   ├── Research log button (existing)
│   └── Settings button (existing)
├── Sidebar.tsx
│   ├── Icon Rail (existing)
│   ├── Flyout Panel (existing, modified)
│   │   └── Products tab content:
│   │       ├── Home button [NEW]
│   │       ├── Create split-button [NEW]
│   │       ├── Import button [NEW]
│   │       ├── Artifact tree (existing)
│   │       └── File list (existing)
│   └── Remove "New Product" button from products tab [REMOVE]
│   └── Consider removing "Outputs" tab [V2]
└── MainPanel.tsx (modified)
    ├── Tabs bar
    │   └── Remove "Show Chat" button [REMOVE]
    ├── Editor content (existing)
    └── ChatPanel.tsx [MOVED to right side]
        └── Resize handle now on LEFT edge
```

### Key CSS/Layout Changes

1. **MainPanel flex direction stays `row`** but chat panel moves to the END (right side):
   ```
   Before: [ChatPanel] [ResizeHandle] [EditorContent]
   After:  [EditorContent] [ResizeHandle] [ChatPanel]
   ```

2. **Product Switcher Panel** is an absolutely positioned overlay below TopBar:
   ```css
   position: absolute;
   top: 100%; /* below TopBar */
   left: 0; right: 0;
   z-index: 50;
   ```

3. **Create Split-Button** uses a button group pattern:
   ```
   [  + Create  |▾]  [↓ Import]
   ```
   Two buttons in a `.flex.gap-2` container, first button has two click zones.

### State Flow

```
showProductPanel: boolean (new state in Workspace.tsx)
  → passed to TopBar as prop
  → TopBar renders ProductSwitcherPanel when true

showChat: boolean (existing, unchanged semantics)
  → ChatPanel rendering moves to right side of editor
  → TopBar gets onToggleChat prop (was only MainPanel)

activeTab: string (existing)
  → 'products' tab content gets Home + Create/Import buttons
  → 'artifacts'/'outputs' tab becomes optional in V2
```

---

## Handoff Contract

| Field | Value |
|-------|-------|
| **Summary** | Complete UX specification for 4 navigation improvements: product switcher panel, sidebar Home button, unified Create/Import, chat-as-right-sidebar. Includes interaction flows, all screen states, accessibility requirements, and FE component annotations. |
| **Decisions made** | Panel overlay (not modal) for product switcher; split-button (not separate buttons) for Create; right sidebar (not drawer) for chat; Home button in sidebar flyout (not icon rail) |
| **Open risks** | Chat panel direction swap needs careful testing for existing chat-focused mode; split-button pattern may need custom component (not in existing UI library) |
| **Artifacts produced** | This UX Spec (`ux-spec.md`) |
| **Handoff to next agent** | Frontend Agent — implement components per the component hierarchy and interaction specs |
| **Blockers** | None |
