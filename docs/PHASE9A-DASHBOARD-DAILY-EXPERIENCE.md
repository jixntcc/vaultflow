# Phase 9A — Core Dashboard / Daily Experience

## Status: IMPLEMENTED

Phase 9A begins the product-evolution cycle with a user-facing dashboard improvement while preserving all existing domain contracts.

## New Daily panel

The dashboard now opens with a compact `Today` section answering four questions:

1. How are today's habits progressing?
2. What is the closest active goal?
3. How much has been spent today?
4. What deserves attention right now?

Each item is an existing shared action contract and navigates to its owning domain.

## Data sources

The panel does not create a new data store.

It reads:
- Transactions from the existing transaction source
- Habits through `HabitDomain.buildTodaySummary`
- Goals from the existing Goals store/domain data
- Intelligence from the existing Intelligence state

## Responsive behavior

Desktop:
- 4 daily cards in one row

769–1050px:
- 2 × 2

≤768px:
- 2 × 2

≤480px:
- 1 column

The panel uses touch-friendly mobile sizing.

## Architectural rule

No new domain was created.

The flow remains:

Entity/domain state
→ dashboard-derived view model
→ existing `data-vf-action`
→ shared navigation
→ domain UI

## Validation

Focused Phase 9A test: PASS

Full regression:
- PASS: 42
- SKIP: 1
- FAIL: 0

The remaining skip is the known live staging HTTP suite because `STAGING_BASE_URL` is not configured.
