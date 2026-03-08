# LiteLLM Routing Profiles (Phase B)

This document describes how productOS uses LiteLLM routing profiles in a **single existing settings surface** (Global Settings → AI), without introducing duplicate or unrelated screens.

## Goals

- Support two practical operating modes:
  1. **Offline usage** (local-only)
  2. **Token-optimized usage** (quality/cost routing)
- Keep UX simple:
  - one routing configuration surface
  - one billing/usage surface

## Where configuration lives

Only in **Global Settings → AI → LiteLLM Router (Beta)**.

No separate “LiteLLM dashboard” or extra cost screens are introduced.

## Profiles

### 1) Offline Local (Beta)

Recommended for air-gapped, private, or low-cost operation.

- default: `local-fast`
- research: `local-heavy`
- coding: `local-code`
- editing: `local-fast`
- `offlineStrict: true` (enforces local-only aliases)

### 2) Single Vendor Tiered (Beta)

Recommended when staying inside one provider account.

- default: `anthro-fast`
- research/coding: `anthro-top`
- editing: `anthro-fast`

### 3) OpenRouter Smart (Beta)

Recommended when using OpenRouter as unified provider layer.

- default: `or-fast`
- research/coding: `or-reasoning`
- editing: `or-fast`

## Mode controls

- **Off**: LiteLLM disabled
- **Silent**: routing decisions are observed but not enforced as active provider behavior
- **Active**: LiteLLM used as active provider

## Offline strict behavior

When `offlineStrict` is enabled, non-local aliases are rejected and model selection falls back to the default local alias.

## Usage/cost integration

Billing remains in existing **Billing & Usage** section.

Routing profile context is shown there for attribution clarity, while preserving the same single cost view users already know.

## Implementation notes

- Backend settings model now stores:
  - `profileId`
  - `offlineStrict`
- Existing strategy fields remain in place and are updated by profile presets.
- No breaking migration expected:
  - missing profile fields default to `offlineLocal` + strict mode.
