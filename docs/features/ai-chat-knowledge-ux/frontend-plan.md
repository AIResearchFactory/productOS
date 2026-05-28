# Frontend Implementation Plan - AI Chat & Knowledge Workspace Alignment

**Feature Name:** Contextual Comments & Focused Chat UI  
**Status:** Under Review  
**Date:** May 28, 2026  
**Stage:** Frontend Planning Phase (Stage 3 of the Feature Development Pipeline)

---

## 1. Component Architecture & Plan

We will add one new component and modify five existing components inside `src/components/workspace/` to implement the approved UI updates.

### New Component
1. **`FilePeekPanel.tsx` (Right Slide-over Drawer):**
   - Renders inside `MainPanel.tsx` aligned to the right-hand edge.
   - Props:
     - `isOpen: boolean`
     - `onClose: () => void`
     - `filePath: string`
     - `projectId: string`
     - `onAppendToPrompt: (text: string) => void` (for "Clip & Drop" text reference)
   - Internally loads the file using `appApi.readMarkdownFile` and renders it via a clean, read-only preview markdown renderer.

### Modified Components
2. **`MainPanel.tsx` (Layout and View Coordinator):**
   - Extend `layoutMode` to support `'chat-focused'`.
   - COORDINATION: When in `'chat-focused'`, standard tabs and large workflows are collapsed. The `ChatPanel` is expanded.
   - Render the `FilePeekPanel` drawer inline.

3. **`Sidebar.tsx` (Navigation Tree):**
   - Props addition: `compactMode: boolean`.
   - Update layouts to shrink tree entries to clean icons when `compactMode` is active, utilizing hover tooltips for textual detail.
   - Integrate right-click context menu handler on document node titles:
     - Adds option `"Reference in Chat"`.
     - Emits custom event `productos:chat-prefill-prompt` or a prop callback to append `@fileName` into the chat prompt.

4. **`RichMarkdownEditor.tsx` (Tiptap Inline Highlights & Margin Comments):**
   - Add Tiptap custom Decoration plugin or `@tiptap/extension-highlight` to support warning-colored yellow highlights for commented text spans.
   - Manage marginal comment sidebars. For each comment fetched from backend registry:
     - Find the corresponding anchor range using Tiptap node offsets.
     - Compute node coordinates dynamically using `editor.view.coordsAtPos(fromPos)`.
     - Position the custom absolute comment cards in a right margin tray.
   - Props:
     - `comments: Comment[]`
     - `onAddComment: (text: string, anchorRange: { from: number; to: number; text: string }) => void`
     - `onResolveComment: (commentId: string) => void`

5. **`MarkdownEditor.tsx` (Document Toolbar):**
   - Read comment list from file registry.
   - If there are open comments, render the **"Fix All Comments"** button at the top toolbar (outline button with primary accent border).
   - Hook button to invoke the bulk patch stream action.

6. **`ChatPanel.tsx` (Focused Dashboard, prompt HUD, and Diff renderer):**
   - Adapt layout to support full centering `layoutMode === 'chat-focused'`.
   - Style a central wide conversation view.
   - Build **HUD Context Shelf** above chat input:
     - A horizontal bar displaying attached files as rounded badges with close buttons.
   - Build **AI Revision Diff Card** renderer inside message bubble items:
     - Identifies diff message tags like `<REVISION_DIFF>` or custom blocks.
     - Displays standard red deletions/green additions of text blocks.
     - Embeds inline buttons: `[Accept Changes]` and `[Reject]`.

---

## 2. State & Event Model

### State Hierarchy
- **`Workspace.tsx` / `MainPanel.tsx` (Global layout state):**
  - `layoutMode: 'split' | 'full' | 'hidden' | 'chat-focused'`
  - `activePeekFile: string | null` (Active file inside peek slide-over drawer)
- **`MarkdownEditor.tsx` (Local document state):**
  - `activeComments: Comment[]`
  - `selectedAnchorRange: { from: number; to: number; text: string } | null`
- **`ChatPanel.tsx` (Local conversation state):**
  - `hudContextFiles: string[]` (Files added as references)

### Custom Event Channels
- **`productos:chat-reference-file`:** Emitted when a user right-clicks a sidebar file or clicks "Reference in Chat", appending `@fileName` to input text.
- **`productos:chat-peek-file`:** Emitted when a user clicks an `@file` link in chat logs or input box, instructing `MainPanel` to open the peek panel drawer.

---

## 3. API Contract Usage

The frontend interfaces with the Node.js backend using fetch wrapper handlers in `src/api/server.ts`:

1. **`appApi.fetchComments(projectId, filePath)`**
   - Routes to `GET /api/projects/:projectId/files/:filePath/comments`
2. **`appApi.saveComment(projectId, filePath, comment)`**
   - Routes to `POST /api/projects/:projectId/files/:filePath/comments`
3. **`appApi.resolveCommentsPatch(projectId, filePath, patches)`**
   - Routes to `POST /api/projects/:projectId/files/patch-preview` (runs single or bulk edits through LLM agent stream)

---

## 4. Responsive Behavior

- **Mobile Viewports (< 768px):**
  - The side-over `FilePeekPanel` expands to full-screen overlay width.
  - Marginal comment cards collapse into standard floating badge icons placed near the text line; clicking an icon opens an overlays drawer from the bottom sheet, preventing visual squeeze.
- **Desktop/Large (> 1200px):**
  - Margin comments align dynamically next to their exact paragraph lines, preserving comfortable document reading space.

---

## 5. Implementation Notes & Risks

- **Text Offset Shifts:** As users type and edit documents, hardcoded character indexes (`from`/`to`) can shift.
  - *Mitigation:* The frontend will store selection range texts (`anchorText`) alongside offsets. Tiptap will run a search regex/matching fallback on editor load to re-sync offsets if the index becomes stale.

---

## 6. PR-Ready Checklist

- [ ] Light & Dark themes verified (colors match HSL guidelines, high readability).
- [ ] No emojis used as structural navigation icons.
- [ ] Keyboard navigation fully traversable (focus rings visible).
- [ ] Accessibility roles (`role="dialog"`, aria-labels) applied on peek drawers and comments.

---

## 7. Telemetry & Analytics Specs

The frontend coordinates with the existing global `telemetryApi.track` helper method in `src/api/server.ts` to log specific user behaviors:

1. **`comment.created`:**
   - Triggered when the user successfully adds a new comment to a document.
   - Payload:
     ```json
     {
       "commentId": "comment_1715000000",
       "filePath": "artifacts/prd_v2.md"
     }
     ```
2. **`comment.resolved`:**
   - Triggered when a comment is resolved (either directly via human manual action or after accepting an AI-suggested patch).
   - Payload:
     ```json
     {
       "commentId": "comment_1715000000",
       "filePath": "artifacts/prd_v2.md",
       "resolvedBy": "user" | "ai"
     }
     ```

