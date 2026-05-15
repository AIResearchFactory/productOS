# ProductOS UX Simplification Brief

## Goal

Simplify ProductOS so the product feels like a focused PM operating system instead of a dense collection of powerful but competing surfaces.

The current UI already has strong capabilities. The next design pass should reduce exposed complexity, clarify the primary user path, and make Copilot feel like the action layer that uses product context rather than a separate side panel competing with the workspace.

## Current capability map

ProductOS currently exposes these major capabilities:

- Product workspaces
- Files and source context
- Structured outputs/artifacts: PRDs, roadmaps, one-pagers, insights, research, launch docs, presentations
- Visual workflows and scheduled/reusable automation
- Skills and reusable AI behaviors
- Copilot chat with product context
- AI provider/model configuration
- MCP/integrations marketplace
- Research log/audit trail
- Local-first Markdown ownership

## Problem statement

The issue is not missing capability. The issue is that the UI exposes too many concepts at the same level.

Observed friction:

1. Too many navigation layers: top product switcher, control rail, flyout/sidebar, workspace tabs, product home cards, and Copilot panel.
2. Repeated product context: the active product is shown in multiple locations at once.
3. Ambiguous primary action: Product Home, Copilot, quick actions, recommended tasks, and sidebar CTAs all ask for attention.
4. Capability naming is implementation-first: Skills, Artifacts, Workflows, Models are accurate but not how many PMs describe the work they want to do.
5. Settings and model configuration feel too prominent for day-to-day product work.

## Recommended IA

Reduce the main navigation to four product-first surfaces plus settings:

1. **Home**
   - Product status
   - Next best action
   - Recent work
   - One prominent Copilot/action composer

2. **Context**
   - Files, notes, transcripts, specs, research, imported docs
   - The place to add or inspect source material

3. **Outputs**
   - PRDs, roadmaps, one-pagers, insights, decks, launch docs
   - User-facing PM deliverables generated from context

4. **Automations**
   - Workflows, schedules, recurring research, reusable skills/tools
   - Anything that repeats work or acts on the user's behalf

5. **Settings**
   - Models/providers
   - Integrations/MCP
   - Billing/usage
   - System/about

## Product Home behavior

Product Home should act as a guided command center, not another dashboard of equal-weight cards.

Recommended next-action logic:

- No context files: primary CTA is **Add context**
- Context exists but no outputs: primary CTA is **Create first output**
- Outputs exist but no automations: primary CTA is **Automate recurring work**
- Product is mature: primary CTA is **Ask Copilot for next actions**

Secondary actions should remain visible but lower-emphasis.

## Naming recommendations

- Rename **Projects** to **Products** where the domain is PM/product work.
- Rename **Artifacts** to **Outputs** or **Docs** in the main navigation.
- Move **Skills** under **Automations** as reusable tools/prompts.
- Keep **Models** under **Settings**, not the core workspace rail.
- Use **Research log** as a contextual audit/history feature, not a primary navigation item.

## Design principles for the simplification pass

1. One active product, one obvious next action.
2. Navigation should describe user intent, not implementation details.
3. Copilot is the action layer for product context, not a competing app inside the app.
4. Configuration should be available but not visually equal to product work.
5. Empty, loading, and error states should teach the next useful step.
6. Keep local-first ownership visible as a trust signal, not the whole headline.

## Acceptance criteria

- A new user can understand the product flow in under 30 seconds.
- The primary CTA on Product Home changes based on readiness state.
- Main navigation has no more than five top-level destinations.
- Skills and model configuration no longer compete with day-to-day product work.
- Product Home, Context, Outputs, and Automations each have clear empty/loading/error states.
- Keyboard focus states and screen-reader labels are preserved for all new navigation and CTA controls.
