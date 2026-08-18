# Phase 8D — Data Integrity & Recovery

## Status: IMPLEMENTED

Phase 8D strengthens backup/restore so a successful restore means more than "the API calls completed."

## Backup integrity manifest

Every new backup contains:

```text
integrity
  algorithm: counts-v1
  counts:
    transactions
    vaults
    goals
    habits
    habitLogs
    automationRules
```

The counts are checked when the backup is loaded. A mismatched integrity manifest is rejected before destructive restore work begins.

## Pre-restore safety

The existing behavior remains:

```text
Current state
    ↓
Automatic backup
    ↓
Restore requested
```

The pre-restore backup is created before the existing data is deleted.

## Restore ordering

The restore process maintains dependency ordering:

```text
Delete habit logs
Delete habits
Delete goals
Delete transactions
Delete vaults

Create vaults
    ↓
Create transactions
    ↓
Derive wallets
    ↓
Create goals
    ↓
Create habits
    ↓
Create habit logs
    ↓
Create automation rules
    ↓
Derive wallets again
```

Vault ID and Habit ID mappings are preserved so relationships do not point at stale database IDs.

## Wallet integrity

Wallets are derived from restored transactions rather than blindly trusting a serialized wallet balance.

After restoration:

```text
Transactions
    ↓
deriveWalletBalances()
    ↓
HR / HL wallet state
    ↓
assertFinanceConsistency()
```

This prevents a backup containing stale calculated wallet totals from producing a false balance.

## Automation integrity

Automation restore failures are no longer silently swallowed.

Previously a failed rule could be skipped while the UI still reported a successful restore.

Now:
- rule creation failure aborts the restore success path
- restored rule count is compared
- rule name/event/action/enabled definitions are compared

## Post-restore verification

After the database reload, VaultFlow compares:

```text
Expected backup:
  transaction count
  vault count
  goal count
  habit count
  habit-log count
  automation-rule count

Actual restored state:
  same six counts
```

It additionally verifies:
- wallet/transaction financial consistency
- automation rule definitions

The success toast is only shown after these checks pass.

## Important limitation

The restore operation remains multi-request rather than a single MongoDB transaction spanning every domain.

Therefore a mid-restore infrastructure failure can still leave a partially restored state.

The pre-restore safety backup is the recovery mechanism for that failure mode.

A future server-side atomic import endpoint could remove this limitation, but implementing one now would be a larger architectural change and is not required to establish the current integrity gate.

## Validation

Focused Phase 8D test: PASS

Full regression:
- PASS: 42
- SKIP: 1
- FAIL: 0

The remaining skip is the live staging HTTP suite because `STAGING_BASE_URL` is not configured.
