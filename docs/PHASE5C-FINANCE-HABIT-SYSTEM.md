# Phase 5C — Finance + Habit System

## Status: IMPLEMENTED

Phase 5C connects the existing Finance and Habit domains through a derived read-model. It does not merge their domain models and does not create shared mutable state.

## New cross-domain signal

`calculateFinanceHabitCorrelation()` analyzes days on which habits were scheduled and compares habit completion with daily spending.

It provides:
- observedDays
- correlation
- highCompletionDays
- lowCompletionDays
- averageSpendingHighCompletion
- averageSpendingLowCompletion
- spendingDifferencePercent
- per-habit observed completion rates

The model requires at least 7 observed habit days before the UI presents the relationship as a useful signal.

### Interpretation guardrail

This is explicitly presented as a **correlation**, not causation.

The product must not tell users that completing a habit causes them to spend less or more.

## API

The existing authenticated `/api/insights` endpoint now returns:

`financeHabit`

No new authentication or ownership model was introduced.

The read-model is generated exclusively from the authenticated user's domain snapshot.

## Home

The Dashboard now includes a compact:

`Money × Habits`

card.

It surfaces the relationship when enough data exists and otherwise explains how to build enough history.

## Intelligence

The Money Intelligence page includes a full Finance × Habits panel with:
- high-completion-day spending
- lower-completion-day spending
- percentage difference
- correlation signal
- per-habit completion context
- explanatory disclaimer

## Domain integrity

Finance remains Finance.

Habits remain Habits.

The relationship is derived:

Transactions + Habit Logs
        ↓
Cross-domain analytics
        ↓
Read model
        ↓
UI

No transaction is modified because of a habit.
No habit log is modified because of a transaction.

## Validation

- Phase 5C engine smoke test: PASS
- Phase 5C static assertions: PASS
- Full regression: PASS
- Phase 2/3/4/4H/4I suites: PASS
- Live staging HTTP suite: still pending because `STAGING_BASE_URL` is not configured.
