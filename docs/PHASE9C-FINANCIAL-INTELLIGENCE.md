# Phase 9C — Financial Intelligence

## Status: IMPLEMENTED

Phase 9C evolves the existing intelligence layer from passive metrics into prioritized, explainable financial signals.

## New experience

The Intelligence page now opens with:

**What your money is telling you**

It surfaces up to three prioritized signals based on the existing financial model.

### Signal types

- Cash-flow pressure when projected monthly surplus is negative
- Thin savings margin when savings rate is below 10%
- Positive saving capacity when savings rate is healthy
- Accelerating spending when expense growth exceeds 10%
- Falling spending when expense growth is below -10%
- Softening income when income growth falls below -10%
- Overall financial-health signal

Each signal includes an explanation and an action that navigates into the relevant existing domain.

## Architecture

No new backend intelligence model was introduced.

The signal engine consumes:

```text
/api/insights
    ↓
VaultFlowStore.intelligence
    ↓
financial.totals
financial.health
financial.forecast
    ↓
buildFinancialIntelligenceSignals()
    ↓
Signal View Model
    ↓
Shared Action Contract
```

This keeps the existing intelligence API authoritative.

## Product principle

Signals are deliberately explanatory rather than pretending to be predictions.

Examples:

> Recent spending is running above income.

rather than:

> You will become financially unstable.

This keeps the intelligence layer grounded in observable user data.

## Responsive UX

Desktop:
- 3 signal cards

Tablet:
- 2 columns

Mobile:
- 1 column
- 44px action targets

## Validation

Focused Phase 9C test: PASS

Full `npm test`: PASS

- PASS: 43
- SKIP: 1
- FAIL: 0

The remaining skip is the known live staging HTTP suite because `STAGING_BASE_URL` is not configured.
