# Phase 4H-4 — Database, Concurrency & Sync Hardening

## Status: PASS

### 1. Database indexes
Added/confirmed indexes for ownership and high-frequency queries:
- Vault: `{ userId, createdAt }`
- Transactions: `{ userId, date }`, `{ userId, vaultId }`
- Goals: `{ userId, status, deadline }`, `{ userId, vaultId }`
- Habits: `{ userId, status, createdAt }`
- Habit logs: unique `{ userId, habitId, scheduledDate }`
- Push subscriptions: `{ userId, updatedAt }`, `{ userId, endpoint }`
- Automation rules: `{ userId, enabled, event }`, `{ _id, userId }`
- Mutation receipts: unique `{ userId, key }` plus processing lease index
- Automation triggers: unique `{ ruleId, key }`

### 2. Financial transaction concurrency
`runFinancialMutation()` now executes with:
- snapshot read concern
- majority write concern
- bounded commit time

Mongoose's transaction wrapper retains transient-transaction retry behavior.

Vault balance rebuilds continue to run inside the same transaction as the financial mutation.

### 3. Offline sync atomicity
Each sync mutation now runs as one database transaction containing:
1. idempotency receipt claim
2. ownership validation
3. domain mutation
4. vault balance rebuild when relevant
5. receipt completion

Therefore the system no longer has the dangerous sequence:

`domain write succeeds -> process dies -> receipt write never happens -> retry duplicates domain data`

The receipt and domain write now commit or roll back together.

### 4. Idempotency leases
Mutation receipts now have:
- `processing`
- `completed`
- `processingUntil`

A concurrent request with the same `(userId, key)` cannot execute the same mutation while another request owns the lease.

Expired leases can be reclaimed.

The unique `(userId, key)` index remains the database-level final defense.

### 5. Habit-log duplicate protection
Habit logs retain the unique `(userId, habitId, scheduledDate)` constraint and use an atomic upsert inside the sync transaction.

### 6. Automation duplicate-trigger protection
Added `AutomationTrigger`.

A scheduler invocation claims a unique `(ruleId, key)` trigger before sending.

States:
- `processing`
- `sent`
- `failed`

A short processing lease allows recovery if an invocation dies.

This closes the scheduler race where two workers could both observe an old `lastTriggeredAt` and both send the same automation.

Push delivery retains its existing `NotificationDelivery` uniqueness protection.

### 7. Regression
- Node syntax checks: PASS
- Phase 4H-4 assertions: PASS
- Full VaultFlow regression suite: PASS

## Staging requirements

A real MongoDB replica-set staging environment is required to validate:
- two concurrent transaction writes against the same user's vault
- duplicate sync requests sent simultaneously
- worker/scheduler concurrency
- process interruption between external push delivery and database acknowledgement
- transaction retry behavior
- unique-index enforcement
- index creation and query plans

The current environment has no MongoDB runtime, so those are explicitly staging tests rather than claimed local execution.
