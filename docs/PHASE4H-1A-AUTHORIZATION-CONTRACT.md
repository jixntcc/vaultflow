# Phase 4H-1A — Authorization Contract Hardening

## Objective

Enforce one resource-ownership invariant across VaultFlow:

> Every authenticated resource lookup or mutation must be scoped to the authenticated `req.user.userId`, and every nested resource reference must independently belong to that user.

## Changes

### 1. Central ownership helper

Added `services/authorization-contract.js` with `assertOwnedResource()`.

The helper always builds a resource filter containing:

```js
{
  _id: resourceId,
  userId
}
```

Invalid/missing resource IDs are treated as not-found rather than leaking database cast errors.

`assertOwnedVault()` now delegates to this helper.

### 2. Offline transaction integrity

The normal transaction API already verified `vaultId` ownership. The offline `transaction_create` path did not.

It now performs the same `assertOwnedVault()` check before creating the transaction and derives `vaultId` / `vaultName` from the owned vault instead of trusting client-supplied vault metadata.

### 3. Push subscription ownership

Push subscription endpoints are treated as account-owned credentials.

A subscription endpoint already belonging to another user cannot be reassigned through `/api/notifications/subscribe`.

Cross-account attempts return `409`.

### 4. Authorization regression tests

Added `tests/phase4h-1a-authorization-contract.js` covering:

- central ownership helper behavior
- invalid resource IDs
- transaction list ownership
- vault list ownership
- goal list ownership
- habit list ownership
- habit-log ownership
- nested habit ownership in sync
- nested vault ownership in sync
- push subscription cross-account rejection
- push subscription update scoping

## Current invariant

```text
JWT
 ↓
req.user.userId
 ↓
resource query includes userId
 ↓
MongoDB
```

For nested resources:

```text
User A
 ↓
Parent resource ownership check
 ↓
Child mutation
```

No client-supplied `userId` is accepted as an authority source.

## QA result

All existing Phase 2 → Phase 4 regression tests pass, plus the Phase 4H-1A authorization contract suite.

A true two-account HTTP/MongoDB integration attack matrix should be executed against a staging MongoDB in Phase 4I. This source-level contract suite is the permanent regression gate until that environment exists.
