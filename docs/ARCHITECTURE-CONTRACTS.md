# VaultFlow 2.0 — Architecture Contracts

## State
`window.VaultFlowStore` owns the future application state boundary.

Domains:
- auth
- finance
- planning
- habits
- reports
- preferences
- ui

## API
`window.VaultFlowApi.request()` is the future transport boundary. The legacy `apiCall()` remains until domain migration is tested.

## Responsive UI
Viewport size may change presentation, but never business capabilities. Desktop and mobile must expose the same CRUD actions.

## Habits
Use separate `Habit` and `HabitLog` domains. Server-side ownership must always be based on the authenticated user. Check-ins should be idempotent for `(userId, habitId, date)`.

## Backup
Every persistent domain must be included in backup/restore before feature completion.

## Domain migration status
Transactions and Vaults now use `VaultFlowStore` as their frontend source of truth. Goals remain on the legacy global until Phase 2E.

## Wallet invariant
Wallet balances are derived from canonical transactions and stored in `VaultFlowStore.finance.wallets` as derived state. UI code must not independently mutate wallet balances.
