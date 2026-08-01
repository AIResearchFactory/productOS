# UX Spec: OKF Context Layer — User Interaction & UI Design

> **Feature**: `okf-context-layer`
> **Branch**: `feature/okf-context-layer`
> **Stage**: UX Agent → **Updated with Feedback**

---

## 1. Executive Summary

This UX specification defines the user interface updates and interaction flows for the OKF Context Layer in ProductOS:

1. **Product Home Completeness Banner**: Prompts users to create `personas.md` or `competitors.md` when missing, completing the project's AI context graph.
2. **Personalization Settings UI (Input & Review)**:
   - **Writing Style Starter Template**: 1-click button to pre-fill writing rules with export-ready document guidance.
   - **Preferred Domain Keywords**: Dedicated text area and tag review UI for terminology the AI should actively use.
   - **Keywords & Phrases to Avoid**: Dedicated text area and tag review UI for forbidden terms, buzzwords, or restricted jargon.
3. **Template Guiding Questions Flow in Copilot**: Interaction pattern where AI agents ask template-specific questions (including Personas, JTBD, Performance, Telemetry, Security, and Accessibility for PRDs) before generating artifacts.

---

## 2. Screen Specs & UI Layouts

### Screen 1: Personalization Settings — Keywords Input & Review UI

**Placement**: `ProjectSettings.tsx` > `Personalization` ```text
┌───────────────────────────────────────────────────────────────────────────────────┐
│ Personalization                                                                   │
│ Configure AI writing rules, vocabulary, and brand guidelines for this project.    │
├───────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│ Writing Rules & Tone of Voice                                                     │
│ Guidelines for text generation. Formatting is governed by artifact templates.      │
│                                                                                   │
│ [ Load Starter Template ]   (Visible when field is empty)                          │
│ ┌───────────────────────────────────────────────────────────────────────────────┐ │
│ │ ## Tone & Voice                                                               │ │
│ │ - Professional, clear, and authoritative                                       │ │
│ │ ## Target Artifact Quality                                                    │ │
│ │ - Documents and presentations should be export-ready for executive review     │ │
│ │ └───────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                   │
│ ─── DOMAIN VOCABULARY & KEYWORD REVIEW ────────────────────────────────────────── │
│                                                                                   │
│ Preferred Domain Keywords                                                         │
│ Terms, acronyms, and product terminology the AI should use (comma-separated).     │
│ ┌───────────────────────────────────────────────────────────────────────────────┐ │
│ │ ProductOS, OKF, Agent Steering, Discovery Phase, First-Class Artifact         │ │
│ └───────────────────────────────────────────────────────────────────────────────┘ │
│ Active Review Tags:                                                               │
│ [ ProductOS ✕ ]  [ OKF ✕ ]  [ Agent Steering ✕ ]  [ Discovery Phase ✕ ]           │
│                                                                                   │
│ Keywords & Phrases to Avoid                                                       │
│ Forbidden buzzwords, competitors to refrain from mentioning, or restricted jargon.   │
│ ┌───────────────────────────────────────────────────────────────────────────────┐ │
│ │ synergy, paradigm shift, leverage, low-hanging fruit                          │ │
│ └───────────────────────────────────────────────────────────────────────────────┘ │
│ Active Review Tags:                                                               │
│ [ synergy ✕ ]  [ paradigm shift ✕ ]  [ leverage ✕ ]  [ low-hanging fruit ✕ ]      │
│                                                                                   │
│ ─── BRAND DESIGN (PRESENTATION MODE) ─────────────────────────────────────────── │
│                                                                                   │
│ Brand Design Rules                                                                │
│ Saved as JSON; used when generating and downloading presentation decks.          │
│ ┌───────────────────────────────────────────────────────────────────────────────┐ │
│ │ { "colors": { "primary": "#003366" }, "fonts": { "heading": "Inter" } }       │ │
│ └───────────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

### Screen 2: ProductHome Context Completeness Banner

```text
┌───────────────────────────────────────────────────────────────────────────────────┐
│ 💡 AI Context Warning                                                            │
│ Your product context is missing personas.md and competitors.md.                  │
│ Adding these files helps AI agents tailor recommendations to your target users.  │
│                                                                                   │
│ [ + Create Personas File ]    [ + Create Competitors File ]   [ Dismiss ]         │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

### Screen 3: Copilot Guiding Questions for PRDs

When a user asks Copilot to generate a PRD:

```text
┌───────────────────────────────────────────────────────────────────────────────────┐
│ 🤖 Copilot                                                                         │
│                                                                                   │
│ Before I draft your PRD using your team's template, please clarify a few key      │
│ details to ensure an export-ready deliverable:                                    │
│                                                                                   │
│ 1. Personas: Who are the target user personas for this feature?                   │
│ 2. Problem / JTBD: What specific problem or Job-to-be-Done are we solving?        │
│ 3. Non-Functional Requirements:                                                   │
│    • Performance: Any latency or throughput targets?                              │
│    • Telemetry: What events/metrics must be tracked?                              │
│    • Security & Privacy: Any auth, encryption, or compliance rules?               │
│    • Accessibility: Any screen-reader or keyboard navigation requirements?       │
└───────────────────────────────────────────────────────────────────────────────────┘
```�─────────────────────────────────────────────────────────────────────┘
```

---

### Screen 2: ProductHome Context Completeness Banner

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│ 💡 AI Context Warning                                                            │
│ Your product context is missing personas.md and competitors.md.                  │
│ Adding these files helps AI agents tailor recommendations to your target users.  │
│                                                                                   │
│ [ + Create Personas File ]    [ + Create Competitors File ]   [ Dismiss ]         │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

### Screen 3: Copilot Guiding Questions for PRDs

When a user asks Copilot to generate a PRD:

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│ 🤖 Copilot                                                                         │
│                                                                                   │
│ Before I draft your PRD using your team's template, please clarify a few key      │
│ details to ensure an export-ready deliverable:                                    │
│                                                                                   │
│ 1. Personas: Who are the target user personas for this feature?                   │
│ 2. Problem / JTBD: What specific problem or Job-to-be-Done are we solving?        │
│ 3. Non-Functional Requirements:                                                   │
│    • Performance: Any latency or throughput targets?                              │
│    • Telemetry: What events/metrics must be tracked?                              │
│    • Security & Privacy: Any auth, encryption, or compliance rules?               │
│    • Accessibility: Any screen-reader or keyboard navigation requirements?       │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. UI State Matrix

| Element | Empty State | Editing State | Review / Active State |
|---|---|---|---|
| **Writing Rules** | Displays "Load Starter Template" button | User typing in textarea | Text saved to `personalization_rules` |
| **Preferred Keywords** | Textarea empty; "No keywords configured" preview | User typing comma-separated terms | Interactive chips/tags displaying parsed terms |
| **Avoided Keywords** | Textarea empty; "No avoided terms configured" preview | User typing comma-separated terms | Interactive chips/tags displaying parsed forbidden terms |
| **ProductHome Banner** | Hidden if both `personas.md` & `competitors.md` exist | Spinner on CTA click | Banner disappears with toast confirmation |
