# VaultFlow 2.0 — Phase 2E

## Goals migration

Goals now use the same Store pattern as Transactions and Vaults:

```text
API / Demo
  ↓
loadGoals()
  ↓
setGoals()
  ↓
VaultFlowStore.planning.goals
  ↓
getGoals()
  ↓
UI / backup / onboarding / PDF
```

The legacy application-level `let goals = []` state was removed.

## Transaction edit date/time fix

### Root cause

`showTransactionModal(id)` correctly loaded the existing transaction date/time, but then unconditionally called `setDefaultDateTime()` afterward. That overwrote the original values with the current system date/time.

### New behavior

- New transaction → current local date/time is populated.
- Existing transaction → original stored date/time is preserved.
- Default date/time now uses the user's local calendar/time rather than `toISOString()`'s UTC calendar date.

Example:

```text
Stored transaction: 02-02-2026
Open Edit:
Date → 02-02-2026
Time → original transaction time
```

## Verification

The phase includes static assertions for:

- Store-backed Goals
- removal of the legacy global Goals state
- session clearing of Goals
- edit modal default-date behavior
- local-date default generation
