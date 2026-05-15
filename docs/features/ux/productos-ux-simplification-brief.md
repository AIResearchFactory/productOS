# ProductOS UX Simplification Brief

## Goal

Simplify ProductOS so the product feels like a focused knowledge and context management tool instead of a dense collection of powerful but competing surfaces. 

We now understand that the right product category for us is **Knowledge Management** with a specific focus on context management. For inspiration, we look towards tools like **OneNote and Notion**, where the focus is on content and providing quick access to create and edit documents.

The current UI already has strong capabilities. The next design pass should reduce exposed complexity, clarify the primary user path, and make the AI ("Ask ProductOS") feel like an integrated action layer that uses product context rather than a separate side panel competing with the workspace.

## Current capability map

ProductOS currently exposes these major capabilities:

- Product workspaces
- Files and source context
- Structured outputs (formerly artifacts): PRDs, roadmaps, one-pagers, insights, research, launch docs, presentations
- Visual workflows and scheduled/reusable automation
- Skills and reusable AI behaviors
- "Ask ProductOS" chat with product context
- AI provider/model configuration
- MCP/integrations marketplace
- Research log/audit trail
- Local-first Markdown ownership

## Problem statement

The issue is not missing capability. The issue is that the UI exposes too many concepts at the same level.

Observed friction:

1. Too many navigation layers: top product switcher, control rail, flyout/sidebar, workspace tabs, product home cards, and Copilot panel.
2. Repeated product context: the active product is shown in multiple locations at once.
3. Ambiguous primary action: Product Home, Ask ProductOS, quick actions, recommended tasks, and sidebar CTAs all ask for attention.
4. Capability naming is implementation-first: Skills, Workflows, Models are accurate but not how many users describe the work they want to do.
5. Settings and model configuration feel too prominent for day-to-day work.

## Recommended IA

Reduce the main navigation to a two-level structure (General and Content), taking inspiration from OneNote and Notion's navigation for changing notebooks and adding sections/pages:

**1. General**
   - **Product Home**: Product status, next best action, recent work, access to product settings, and one prominent "Ask ProductOS" action composer.
   - **Automation**: Contains **Workflows** and **Skills**. Anything that repeats work or acts on the user's behalf.

**2. Content**
   - **Files**: Notes, transcripts, specs, research, imported docs. Ready to contain multiple files.
   - **Outputs**: PRDs, roadmaps, one-pagers, decks, launch docs. Ready to contain multiple outputs. Actions: import, export, and add new.

The product switcher allows choosing the active product, similar to selecting notebooks in OneNote.

**3. Settings**
   - Models/providers
   - Integrations/MCP
   - Billing/usage
   - System/about

## Product Home behavior

Product Home should act as a guided command center, not another dashboard of equal-weight cards.

Recommended next-action logic:

- No files: primary CTA is **Add context**
- Files exist but no outputs: primary CTA is **Create first output**
- Outputs exist but no automations: primary CTA is **Automate recurring work**
- Product is mature: primary CTA is **Ask ProductOS for next actions**

Secondary actions should remain visible but lower-emphasis.

## Naming & Theme recommendations

- Change the terminology from **Copilot** to **Ask ProductOS** to avoid confusion with Microsoft tools.
- Rename **Artifacts** to **Outputs** in the main navigation.
- Move **Skills** and **Workflows** under **Automation**.
- Keep **Models** under **Settings**, not the core workspace rail.
- **Color Theme**: Maintain the blue theme, but lighten it. The current color scheme resembles a security product too much. Introduce a better, lighter dark theme and a friendlier light theme to better fit a Knowledge Management product.

## Design principles for the simplification pass

1. One active product, one obvious next action.
2. Navigation should describe user intent and focus on content hierarchy (General vs. Content).
3. "Ask ProductOS" is the action layer for product context, not a competing app inside the app.
4. Configuration should be available but not visually equal to content work.
5. Empty, loading, and error states should teach the next useful step.
6. Keep local-first ownership visible as a trust signal, not the whole headline.

## Acceptance criteria

- A new user can understand the product flow in under 30 seconds.
- The primary CTA on Product Home changes based on readiness state.
- Main navigation has no more than five top-level destinations.
- Skills and model configuration no longer compete with day-to-day product work.
- Product Home, Context, Outputs, and Automations each have clear empty/loading/error states.
- Keyboard focus states and screen-reader labels are preserved for all new navigation and CTA controls.
