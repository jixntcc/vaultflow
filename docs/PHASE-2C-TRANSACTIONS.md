# VaultFlow 2.0 — Phase 2C: Transactions Domain Migration

## Completed

- Removed the legacy `let transactions = []` frontend state.
- Transactions now live in `VaultFlowStore.getState().finance.transactions`.
- Added `getTransactions()` and `setTransactions()` as the domain boundary.
- `loadTransactions()` writes through the store.
- Existing dashboard, reports, backup/export, onboarding, wallet calculations, transaction page, and transaction modal now read from the store.
- Transaction state is cleared when the session is invalidated.
- Added a normalized `buildTransactionViewModel()`.
- Added a shared `renderTransactionActions()` contract.
- Replaced transaction action inline handlers with delegated `data-transaction-action` events.
- Desktop and mobile now use the same Edit/Delete action contract.
- Made transaction search null-safe.

## Transaction view-model contract

Raw records are normalized to:

`id`, `date`, `time`, `type`, `amount`, `category`, `location`, `wallet`, `paymentMethod`, `vaultName`, `notes`.

The table and mobile cards may look different, but they consume the same model and action contract.

## Deliberately unchanged

- Backend transaction schema/routes.
- Transaction business rules.
- Vault allocation logic.
- Demo API implementation.
- Vault/Goal global state.
- Habit Tracking.

## Next

Phase 2D: migrate Vaults into the store, then Goals, wallet derivation, reports, and backup/restore.
