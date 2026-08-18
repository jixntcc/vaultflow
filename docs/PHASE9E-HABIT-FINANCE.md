# Phase 9E — Habit ↔ Finance

## Status: IMPLEMENTED

Phase 9E connects the existing Habit and Finance domains through the existing intelligence read model.

## Existing engine

`calculateFinanceHabitCorrelation()` already compares:

- habit completion by day
- daily spending
- daily income
- high-completion days
- low-completion days
- individual habit completion rates
- correlation signal

Phase 9E makes this information visible in the daily experience instead of leaving it buried in Intelligence.

## Dashboard experience

Added **Habits × Money** to the dashboard.

It shows:

- average spending on high-completion days
- average spending on lower-completion days
- observed spending difference
- strongest individual habit signal

If insufficient history exists, the UI deliberately says it is still building the pattern rather than inventing a conclusion.

Minimum observation threshold remains 7 observed habit days.

## Interpretation boundary

The UI explicitly states that the relationship is an association, not proof of causation.

Examples:

- `Higher-completion days have lower recorded spending`
- not `Completing your habits causes you to spend less`

This is important because the underlying calculation is observational.

## Architecture

No cross-domain mutation was introduced.

```text
Habit domain
      +
Transaction domain
      ↓
calculateFinanceHabitCorrelation()
      ↓
/api/insights
      ↓
VaultFlowStore.intelligence.financeHabit
      ↓
Dashboard View Model
      ↓
Shared action contract
```

Habit data and financial data remain independently authoritative.

## Responsive UX

Desktop:
- 4 metrics

Tablet:
- 2 × 2

Mobile:
- 2 × 2

Small mobile:
- 1 column

Actions retain 44px touch targets.

## Validation

Focused Phase 9E test: PASS

Full `npm test`:
- PASS: 42
- SKIP: 1
- FAIL: 0

The known staging HTTP suite remains skipped because `STAGING_BASE_URL` is not configured.
