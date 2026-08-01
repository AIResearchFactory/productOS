# UX & Notifications Specification - Silent Learner Mode

This document defines how ProductOS notifies and displays Silent Learner Mode status and events within the application user interface.

## 1. User Interface Placement

- **Settings Section**: The entire Silent Learner dashboard, stats grids, optimization scan progress bar, and data controllers are embedded directly under the **Product Settings** page (`ProjectSettings.tsx`).
- **Context Preservation**: By housing settings inside the product settings context, the settings map directly to the active product workspace, removing any global project selector dropdown.
- **Form Dialogs**: A checkbox is presented in the new project creations flows (onboarding and dialog switches) to easily opt-in new workspaces.

---

## 2. In-App UX Notification Rules

Notifications trigger when background compilation changes status or encounters validation alerts:

### Rule 1: First-Ready Memory Alert
- **Trigger**: Distillation generates $\ge 3$ local lessons for the first time in a workspace.
- **Notification Type**: Radix In-app Toast.
- **Copy**:
  - *Title*: `Silent Learner is ready`
  - *Description*: `ProductOS learned {memoryItemCount} local lesson(s) from your recent work. Future AI tasks can now reuse them privately.`
  - *Action*: `Review lessons` (focuses settings).

### Rule 2: Redaction/Safety Pauses
- **Trigger**: Redaction scans locate raw credentials, secrets, or policy-excluded keywords.
- **Notification Type**: Destructive Caution Toast.
- **Copy**:
  - *Title*: `Silent Learner paused`
  - *Description*: `ProductOS found sensitive content and did not save new lessons. Review privacy settings to continue.`

### Rule 3: Ollama / Local Model Alert
- **Trigger**: Distillation jobs complete successfully, but the local Ollama daemon or model is unreachable.
- **Copy**:
  - *Title*: `Local model unavailable`
  - *Description*: `Silent Learner saved local lessons, but Ollama is not ready yet.`

---

## 3. State Machine & Visual Badges

Sidebar navigation items and header controls indicate the active local workspace's state:

| State | Badge Style | Label |
| --- | --- | --- |
| `off` | Gray | `Silent Learner: Off` |
| `observing` | Blue | `Observing` |
| `distilling` | Amber | `Distilling...` |
| `memory_ready` | Emerald | `Memory Ready ✓` |
| `paused` | Red | `Paused ⚠` |
