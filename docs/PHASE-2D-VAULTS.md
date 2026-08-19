# VaultFlow 2.0 — Phase 2D: Vault Migration

## Objective

Migrate the Vault domain from the legacy `let vaults = []` global into `VaultFlowStore.finance.vaults` without changing the backend contract or visible Vault business behavior.

## Completed

- Removed the standalone `let vaults = []` frontend state.
- Added `getVaults()` and `setVaults()` store accessors.
- `loadVaults()` now writes API/demo results into the Store.
- Dashboard/onboarding/transaction forms/goal forms/backup/restore use the Store-backed vault accessor.
- Vault rendering uses Store-backed data.
- Vault CRUD still uses the existing API endpoints and handlers.
- Session invalidation/logout now clears both transactions and vaults from frontend state.
- Demo mode remains compatible because `loadVaults()` synchronizes `demoData.vaults` into the Store.

## Contract

```text
API / Demo adapter
        ↓
loadVaults()
        ↓
setVaults()
        ↓
VaultFlowStore.finance.vaults
        ↓
getVaults()
        ↓
UI / forms / backup / onboarding
```

## Intentionally unchanged

- MongoDB Vault schema
- `/api/vaults` endpoints
- Vault allocation business logic
- Transaction financial mutation logic
- Goal domain migration
- Demo adapter internals

Those are separate stabilization tasks.

## Verification target

There must be no standalone application-level `let vaults = []` state. `demoData.vaults` and local variables such as the report chart's `const vaults = ...` are not application state and remain valid.
