# VaultFlow 2.0 — Phase 2F: Wallet Derivation & Cross-Domain Consistency

## Objective

Move wallet state into `VaultFlowStore` and make wallet balances derived from canonical transactions.

## Canonical ownership

```text
Transactions
    ↓
deriveWalletBalances()
    ↓
VaultFlowStore.finance.wallets
```

Wallets are a derived financial view, not an independently edited source of truth.

## Completed

- Removed the legacy frontend `wallets` global.
- Added `getWallets()` and `setWallets()`.
- Added `deriveWalletBalances()`.
- Added `syncDerivedWallets()`.
- Replaced `calculateWalletBalances()` with Store-backed derivation.
- Dashboard wallet reads now use Store-backed data.
- Added `assertFinanceConsistency()`.
- Session invalidation clears derived wallet state.
- Preserved HR/HL semantics and the old default-to-HR behavior for missing wallet values.

## Invariant

For each supported wallet:

```text
balance = totalIncome - totalSpent
```

All three values are derived from the current transaction set.

## Boundary

`demoData.wallets` remains temporarily as an internal Demo API bookkeeping structure. The application's authoritative wallet state is the Store-derived value.

## Deferred

- Atomic backend transaction/Vault consistency
- Complete Demo/Production API parity
- Browser/E2E testing
- Removal of legacy Demo API bookkeeping
