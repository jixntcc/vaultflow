# Phase 9B — Transaction Experience

## Status: IMPLEMENTED

Phase 9B improves the highest-frequency financial workflow while preserving the existing transaction domain and shared desktop/mobile action contract.

## Improvements

### Faster transaction discovery
Added:
- free-text search across category, location, notes, wallet, vault, payment method and type
- type filter
- from-date filter
- to-date filter
- newest/oldest sorting
- highest/lowest amount sorting
- result count
- one-tap clear filters

### Edit reliability
Existing transaction editing now:
- reads from `getTransactions()`
- preserves the stored date
- preserves the stored time
- populates vaults before assigning the transaction's vault
- never calls `setDefaultDateTime()` for an existing transaction

This explicitly protects the historical-date regression.

### Mobile actions
The existing shared contract remains:

```text
Entity
  ↓
buildTransactionViewModel()
  ↓
renderTransactionActions()
  ↓
data-transaction-action
  ↓
Desktop + Mobile
```

Edit and Delete remain the same actions on both layouts.

Mobile action buttons now have a 44px minimum touch target.

## Architecture

No new transaction store/domain was introduced.

The existing transaction source, action contract, API endpoints and wallet derivation remain authoritative.

## Validation

Focused Phase 9B test: PASS

Full `npm test`: PASS

Current suite:
- PASS: 42
- SKIP: 1
- FAIL: 0

The remaining skip is the live staging HTTP suite because `STAGING_BASE_URL` is not configured.

## Deliberate non-goals

Recurring transactions were not implemented in 9B because they require a defined backend/domain model, scheduling semantics, duplicate-prevention rules and notification behavior. They should be a separate feature slice rather than a UI-only shortcut.
