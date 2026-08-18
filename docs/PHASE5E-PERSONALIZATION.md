# Phase 5E — Personalization

## Status: IMPLEMENTED

Phase 5E makes VaultFlow adapt its Home and Intelligence experience to the user's current financial, goal, and habit signals.

## Architecture

Personalization is a derived read-model. It does not create a second copy of domain data and does not mutate Finance, Goals, or Habits.

```text
Finance + Goals + Habits
          ↓
Personalization engine
          ↓
personalization read-model
          ↓
VaultFlowStore.intelligence
          ↓
Dashboard + Intelligence
```

## Personalization profile

The profile contains:
- mode
- headline
- message
- recommended action
- action page
- priority ranking
- signal scores
- behavioral signal
- data quality metadata

The four focus dimensions are:
- finance
- goals
- habits
- momentum

The highest current signal determines the recommended focus.

## Dashboard

Home now includes a compact personalized focus panel.

It uses the same server-derived recommendation as Intelligence, so the Dashboard and Intelligence pages do not maintain separate personalization logic.

## Intelligence

The Intelligence page now contains a full "Your VaultFlow focus" panel with:
- recommended focus
- explanation
- ranked signals
- behavioral context
- direct action button

## Data quality

The model exposes the amount of data available to it:
- transaction count
- active goals
- active habits
- observed finance/habit days

This makes it possible for future UX work to distinguish between a strong personalization signal and a recommendation generated from limited history.

## Domain integrity

Personalization is read-only derived intelligence.

It does not:
- modify transactions
- modify goals
- modify habits
- modify vaults
- create cross-domain database entities
- change authorization

## Validation

- Phase 5E static assertions: PASS
- Personalization engine smoke test: PASS
- Full regression: PASS
- Phase 2/3/4/4H/4I suites: PASS
- Phase 5C/5D suites: PASS
- Live staging HTTP suite: still pending because `STAGING_BASE_URL` is not configured.
