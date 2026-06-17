# UX Spec: Workspace Recovery & Recent Files

## User Flows

### Flow 1: File Modification & Home Dashboard Update
1. User creates a new file `z-new-idea.md` via the sidebar or Chat panel.
2. User navigates to the "Product Home" dashboard.
3. In the "Recent Files" card, the file `z-new-idea.md` appears at the very top.
4. The list displays up to 3 files, ordered by most recently modified.

### Flow 2: Application Reload Recovery
1. User has tabs `PRD.md`, `competitors.md` (active), and `welcome` open.
2. User refreshes the browser page (or the browser auto-refreshes overnight).
3. The page boots up with the splash screen "Initializing productOS…".
4. Once loaded, the workspace renders with the tabs `PRD.md` and `competitors.md` open, and `competitors.md` remains the active selected tab.
5. If the active project is changed, the tabs are swapped to the ones open for that new project.

## Screen States

### Workspace Tabs
- **Empty State**: If no tabs are saved, open the `Product Home` tab as the single default tab.
- **Tab Restore Transition**: When a project is loading, show the Boot Splash. Once the project state is populated, render the restored tabs immediately to minimize layout shift.

### Recent Files List (Product Home)
- **Empty State**: Show "No files added yet" with a button to "Add your first file".
- **Populated State**: Displays up to 3 files. Each file row shows:
  - File icon.
  - File name (truncated if long).
  - Upper-case file extension/type (e.g. `DOCUMENT`, `CHAT`).
  - Chevron right button.
  - Hover state: Row gets light background highlight, and chevron slides right slightly.

## Interaction Details
- **Sync Timing**: The open tabs list and active tab ID are synced to `localStorage` on any tab opening, closing, or active tab switch.
- **Project Scope**: Storage keys must be postfixed with the current project ID:
  - `productOS_open_documents_${projectId}`
  - `productOS_active_document_${projectId}`
- **Dead Tab Recovery**: If a tab references a file name that is no longer present in the project's files list (e.g., deleted file), that tab is silently omitted from the restored list and closed.
