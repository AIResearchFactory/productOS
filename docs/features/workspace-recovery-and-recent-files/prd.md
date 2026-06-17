# PRD: Workspace Recovery & Recent Files Ordering

## Problem Statement
The user has reported two distinct usability issues:
1. **Recent Files Ordering**: Files created in the project do not show up in the "Recent Files" section of the Product Home page unless they happen to fall first alphabetically, because the frontend slices the first 3 elements of a list sorted alphabetically. The goal of this section is to show files recently created or changed.
2. **Loss of Workspace Context on Reload**: If the browser reloads (which commonly happens when a computer wakes up from sleep overnight due to browser memory saving or dev server HMR reconnection), the user loses all active open tabs/documents, forcing them to find and reopen their work manually.

## User Stories
- **As a user**, I want the "Recent Files" section on my Product Home page to display the most recently created or modified files first, so that I can easily resume work on the files I was just editing.
- **As a user**, I want my open files/documents and my currently active tab to be saved and restored automatically if the application reloads or refreshes, so that I do not lose my context or place in my work.

## Scope

### In-Scope
- Modify `/api/projects/files` to optionally sort files by modification time (`mtime`) descending.
- Update `Workspace.tsx` to retrieve and store project documents sorted by last-modified time.
- Update `Sidebar.tsx` to sort the documents alphabetically for the sidebar explorer UI (preserving typical alphabetical list browse behavior).
- Persist the open document tabs (`openDocuments`) and the currently active document (`activeDocument`) in `localStorage` scoped to the current project.
- Automatically restore the open tabs and active document when a project is loaded or switched.

### Out-of-Scope
- Preserving in-progress unsaved text changes in `localStorage` (this PRD assumes files are saved, only the tab state is recovered).
- Adding sorting options dropdowns in the sidebar file explorer.

## Acceptance Criteria
- Creating or editing a file automatically moves it to the top of the "Recent Files" section on the Product Home page.
- Opening multiple document tabs, refreshing the browser page, and verifying that the same document tabs are restored and the active tab remains selected.
- Switching between projects restores the correct set of open tabs specific to each project.
- The Sidebar document list remains alphabetically sorted.

## Edge Cases
- **Project Switch**: Ensure open documents are saved and loaded independently per project ID.
- **File Deletion**: If a file is deleted from another view or disk, the state recovery logic should filter out non-existent files to avoid showing dead tabs.
- **Empty States**: If a project has no open tabs stored, it should fall back to opening the "Product Home" page.
- **Special Pages**: Special documents like `welcome`, `project-settings`, `global-settings` should be recoverable or handled gracefully.
