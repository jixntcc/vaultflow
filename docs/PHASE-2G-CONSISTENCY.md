# VaultFlow 2.0 — Phase 2G: Cross-Domain Mutation & Consistency

## Audit result

The audit found a real consistency risk in the original architecture:

- Transaction mutations updated the Transaction document and Vault cached totals as separate operations.
- A failure between those operations could leave financial data inconsistent.
- Transaction update logic reversed the old effects and then applied new effects manually.
- Vault percentage changes did not rebuild existing cached totals.
- Expense vault lookups were not consistently user-scoped.
- Deleting a referenced Vault could leave orphaned transaction/goal references.
- Wallets are derived from Transactions, while Vault balances were persisted independently.

## Phase 2G changes

### Atomic financial mutations

Transaction create/update/delete and Vault update/delete now execute through a MongoDB session transaction.

```text
Mutation
  ↓
MongoDB session
  ├── transaction change
  └── vault rebuild
  ↓
commit
```

If any operation fails, the mutation is rolled back.

### Vault rebuild

Added:

`rebuildVaultBalances(userId, session)`

The function calculates:

```text
Vault income
  = sum(all income transactions × current vault percentage)

Vault expenses
  = sum(expense transactions assigned to that vault)

Vault balance
  = income - expenses
```

The persisted Vault totals are therefore treated as a cache derived from the transaction ledger + current vault allocation configuration.

### Vault percentage changes

Changing a Vault percentage now rebuilds all Vault cached totals for that user.

This preserves consistency under the current VaultFlow allocation model.

### Vault deletion

A Vault with existing Transaction or Goal references is no longer silently deleted. The API returns HTTP 409 so the user can resolve the relationship first.

### Validation

Transaction amounts must be finite and greater than zero.

Vault percentages must be between 0 and 100.

## Important business-model note

The current data model does not store an income-allocation snapshot per transaction. Therefore, changing a Vault percentage necessarily changes the historical allocation when totals are rebuilt.

This is a **semantic limitation**, not a bug introduced by Phase 2G.

If Vault percentages are intended to be historical rules, Phase 3 should add an allocation snapshot to income transactions.

## Wallet relationship

Wallet balances remain derived independently from transactions:

```text
Transactions → Wallet derivation
Transactions + Vault percentages → Vault derivation
```

They therefore have a common canonical source and cannot silently drift through separate frontend state.

## Operational requirement

MongoDB transactions require a deployment that supports sessions/transactions (for example, a replica set / MongoDB Atlas deployment). The code intentionally fails the mutation rather than partially committing if a transaction cannot be completed.
