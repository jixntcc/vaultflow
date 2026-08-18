# Phase 7B — Intelligence Shared Mobile/Desktop Interaction Contract

## Status: IMPLEMENTED

Intelligence is now the fifth domain migrated to the Phase 7B interaction architecture.

## Contract

```text
Authenticated Intelligence read model
        ↓
buildIntelligenceViewModel()
        ↓
buildIntelligenceActionContract()
        ↓
┌────────────────────┬────────────────────┐
│ Desktop UI         │ Mobile UI          │
└────────────────────┴────────────────────┘
```

## Entity / read model

Intelligence is a derived, authenticated read model.

Its authoritative source remains the existing `/api/insights` endpoint and the existing Phase 4 intelligence engine.

No new intelligence calculation engine was introduced.

## View Model

`buildIntelligenceViewModel(data)` normalizes:
- savings rate
- projected monthly surplus
- expense ratio
- financial history length
- habit completion
- active habit count
- insights
- goal projections
- recurring patterns
- personalization
- retention
- account plan

The existing financial, habit, goal, personalization and retention algorithms remain unchanged.

## Action Contract

`buildIntelligenceActionContract()` defines:
- refresh
- search
- review habits
- review reports
- create automation
- refresh audit

The action contract is shared by desktop and mobile controls.

## Event handling

Intelligence page controls use:

```text
[data-intelligence-action]
```

with one delegated handler.

Dispatch:
- refresh → `refreshPhase4Insights(true)`
- search → `openPhase4CommandPalette()`
- review-habits → `switchPage('habits')`
- review-reports → `switchPage('reports')`
- create-automation → `createPhase4Rule()`
- refresh-audit → `loadPhase4Audit()`

This removes inline event wiring from the primary Intelligence controls.

## Store

Intelligence now has an explicit read accessor:
- `getIntelligence`
- existing `setIntelligence`
- existing `setIntelligenceLoading`

The API response continues to enter `VaultFlowStore` before presentation.

## Desktop/mobile behavior

The Intelligence header actions use the same Action Contract and render into a shared action host.

Desktop:
- compact horizontal controls

Mobile:
- two-column full-width controls
- 44px minimum touch target

The intelligence cards, charts and domain-specific surfaces retain their existing visual design.

## Validation

- Intelligence contract test: PASS
- Phase 5C/5D/5E/5F regressions: PASS
- Phase 6 regression: PASS
- Phase 7A Mobile Foundation: PASS
- Vault contract: PASS
- Goals contract: PASS
- Habits contract: PASS
- Reports contract: PASS
- Full regression: PASS
- PASS: 42
- SKIP: 1
- FAIL: 0

The remaining skip is the live staging HTTP suite because `STAGING_BASE_URL` is not configured.

## Next

Continue Phase 7B with Settings.

The invariant remains:

`Entity/read model → View Model → Action Contract → Desktop/Mobile UI`.
