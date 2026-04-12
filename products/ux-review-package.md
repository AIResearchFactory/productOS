# productOS UX Review Package

## 1) Journey Map (for UX Expert)

| Journey | Persona | Trigger | Current Steps | Pain Points | Opportunity | Success Metric |
|---|---|---|---|---|---|---|
| First-time setup to first value | New PM user | First app launch | Install wizard -> pick dirs -> pick providers -> fix deps -> personal setup -> complete | Too many setup decisions early, provider/auth confusion | Progressive setup with smart defaults + clearer auth states | Time-to-first-project < 5 min, setup completion rate |
| Returning user resumes work | Existing user | App relaunch | App opens workspace -> select/open project docs/artifacts/workflows | Context switching between chat, docs, workflows | Better “resume where I left off” surface | % sessions with immediate productive action |
| Create new product workspace | PM lead | New initiative starts | New Product -> name/goal -> optional skills/context -> start | Empty-state anxiety, unclear next best action | Guided starter checklist per project | % new projects with first artifact/workflow created |
| Configure provider | Admin/power user | AI responses fail or initial setup | Settings -> AI -> choose provider -> authenticate -> test | Auth methods differ by provider, status ambiguity | Unified provider health card + one-click diagnostics | Provider setup success rate, support tickets |
| Artifact creation flow | PM/analyst | Need PRD/roadmap/etc. | Artifacts -> choose type -> create/edit -> export | Type choice and template expectations unclear | Type-specific guided wizard and examples | Artifact completion + export rate |
| Workflow automation flow | Ops/PM | Repeated manual process | Workflows -> create/edit -> run -> monitor progress -> review outputs | Builder complexity for first-time users | Preset workflow templates + inline guidance | First successful run rate |
| Skill reuse flow | PM/researcher | Need reusable playbook | Skills -> import/create -> edit -> apply | Skill quality/compatibility confidence | Skill quality signals + preview/test harness | Skill reuse per project |
| Channel integration flow | Admin | Wants Telegram/WhatsApp | Settings -> Integrations -> configure -> test send | Credential and routing friction | Step-by-step integration wizard + validation | Test-message success rate |

---

## 2) Screen-by-Screen UX Audit Sheet

| Screen / Area | User Goal | What exists now | Friction | Severity | Revamp Direction |
|---|---|---|---|---|---|
| Installation Wizard (welcome/directory/projects/provider/personal) | Get running quickly | Multi-step wizard with dependency detection | Long path before value; provider confusion | High | Shorten path, defer advanced choices, add defaults and “recommended setup” |
| Onboarding (check/install/welcome/create) | Validate environment and create first project | System checks + install hints + create flow | Overlaps with install wizard, duplicate concepts | High | Merge onboarding and install language into one coherent funnel |
| Workspace shell (TopBar + Sidebar + MainPanel + Chat) | Navigate and act quickly | Multi-pane power UI | Cognitive load for new users | Medium | Mode switch: “Simple” vs “Power” layout |
| Projects panel | Manage project files/artifacts | Rich context menus and nested structures | Information density and mixed content hierarchy | Medium | Stronger grouping + quick actions + cleaner empty states |
| Artifacts panel | Create/manage outputs | Type filters + list + context actions | Many artifact types upfront | Medium | Suggest top 3 types by role, hide advanced types behind “More” |
| Workflows panel + canvas | Automate repeatable tasks | Builder, run, schedule, optimize | Steep learning curve | High | Starter templates, guided builder, better run feedback |
| Global Settings -> AI | Configure providers | Deep provider cards and auth/test controls | High complexity for non-technical users | High | Unified “Provider Health” summary + fix buttons |
| Global Settings -> Integrations | Connect channels | Token fields + test actions | Setup feels technical and brittle | Medium | Guided integration wizard with validation states |
| Project Settings | Define project behavior | General/features/skills/personalization/templates | Template editing is heavy inline | Low-Med | Split advanced template editing into dedicated editor |

---

## 3) Prioritized UI Revamp Backlog

| Priority | Issue | Why it matters | Proposed Change | Effort | Impact |
|---|---|---|---|---|---|
| P0 | Setup funnel is too heavy | Users may drop before first value | Compress onboarding/install to “Quick Start” + “Advanced” | M | H |
| P0 | Provider setup confusion | Blocks core AI value | Provider Health dashboard (detected/authenticated/ready) + fix CTA | M | H |
| P1 | Workflow first-run complexity | Blocks automation adoption | Add opinionated templates + guided run wizard | M | H |
| P1 | Workspace density for new users | Slower activation | Add simplified layout mode + progressive disclosure | L-M | M-H |
| P1 | Artifact type overload | Decision fatigue | Role-based recommendations and fewer default visible types | L | M |
| P2 | Integration setup technicality | Admin friction | Integration setup wizard with explicit validation checklist | M | M |
| P2 | Split logic between install and onboarding | Inconsistent mental model | Unify copy and structure into single lifecycle | M | M |

---

## 4) What to Ask UX Expert to Deliver

1. Revised IA (navigation and grouping)
2. New first-run funnel (wireframes)
3. Provider Health interaction model
4. Workflow first-run guidance UX
5. Prioritized implementation plan (quick wins vs deep changes)

---

## 5) Suggested Review Workflow

1. UX expert reviews this doc
2. 60-minute walkthrough using the 8 journeys
3. Expert proposes new wireframes for top 3 pain points (P0/P1)
4. Convert approved changes into engineering tickets

---

## 6) Ticketization Template (copy/paste)

- **Title:**
- **Journey impacted:**
- **Problem statement:**
- **Current behavior:**
- **Proposed UX change:**
- **Acceptance criteria:**
- **Success metric:**
- **Priority / Effort:**
