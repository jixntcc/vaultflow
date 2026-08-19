# VaultFlow 2.0 — Phase 2: Stabilization & Rebuild Foundation

## Completed

- Removed the frontend's dead refresh-token state/storage.
- Replaced the undefined `refreshAuthToken()` path with deterministic session invalidation.
- Added `public/js/core/store.js` as the new explicit state boundary.
- Added `public/js/core/api-client.js` as the new transport boundary.
- Restored Edit/Delete controls to mobile transaction cards using the same handlers as desktop.
- Added responsive mobile transaction action styling.
- Added `escapeHtml()` to the primary transaction, vault, and goal renderers.
- Removed the duplicate `module.exports = app` line.

## Migration order

1. Authentication/session
2. API client
3. Transactions
4. Vaults
5. Goals
6. Wallet derivation
7. Reports
8. Backup/restore
9. Habits

Legacy globals remain temporarily so the existing application is not destabilized by a big-bang rewrite.

## Deferred

- Full global-state migration
- Full XSS audit
- Transaction/Vault atomicity
- Complete Demo/Production mutation parity
- API schema hardening
- Automated browser tests
- Full refresh-token redesign
