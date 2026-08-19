# VaultFlow Phase 4 — Intelligence & Platform Expansion

Phase 4 adds a composition layer above the stable 3.x domain models. Existing Transaction, Vault, Goal, Wallet and Habit entities remain separate.

## 4.0 Contracts
- `services/phase4-intelligence.js` contains pure, domain-agnostic read-model calculations.
- `VaultFlowStore.intelligence`, `automation`, `sync` and `audit` are coordination state only.

## 4.1 Unified intelligence dashboard
- Cross-domain insights
- Savings rate and projected monthly surplus
- Habit consistency
- Recurring expense count
- Goal forecast cards

## 4.2 Goal projections
`GET /api/goals/projections` calculates:
- progress
- remaining amount
- required monthly contribution
- projected completion date
- at-risk/on-track/completed status

## 4.3 Financial intelligence
- category ranking
- monthly trend
- recent cash-flow forecast
- unusual spending-day detection
- recurring monthly expense detection

## 4.4 Automation engine
Automation rules support:
- goal at risk
- expense threshold
- habit streak
- weekly summary

Rules are evaluated by the existing background scheduler and can deliver Web Push notifications.

## 4.5 Reliability
- `AuditEvent` records authenticated mutations without storing request bodies.
- `MutationReceipt` provides idempotency for offline sync.
- Vault ownership checks from 3.x remain authoritative.

## 4.6 Sync foundation
`POST /api/sync/mutations` supports idempotent:
- `transaction_create`
- `habit_log_create`

The client has a local queue and flushes it when connectivity returns. Existing mutation response contracts are intentionally not changed globally.

## 4.7 Global search
`GET /api/search?q=...` searches:
- transactions
- vaults
- goals
- habits

The UI exposes a Ctrl/Cmd+K command palette.

## Backup
Backup schema is now version `2.0` and includes automation rules. Restore recreates rules after financial/habit data.

## Testing
Run:

```bash
npm test
```

The cross-platform runner executes every `phase*.js` test in `tests/`.
