# Phase 5A — Dashboard / Home Experience

## Status: IMPLEMENTED

Phase 5A upgrades the existing Dashboard into a user-facing Home experience while preserving the VaultFlow Store, domain APIs, transaction renderer contract, habit domain, goals, intelligence, and Phase 4 security contracts.

## UX structure

### Header
- Personalized greeting
- Current-month context
- Quick actions for Transactions and Add Transaction

### Financial overview
- Total balance across derived wallets
- Current-month income
- Current-month spending
- Current-month savings rate

The dashboard deliberately uses the current month for flow metrics rather than lifetime totals.

### Cash flow
- Income
- Spending
- Net cash flow
- Relative visual bars
- Top spending categories

### Focus
A compact priority surface combining:
- Phase 4 intelligence insights when available
- overspending warning
- incomplete habit reminder
- neutral onboarding guidance when there is no urgent signal

### Goals
Shows the top active goals by progress with direct navigation to Goals.

### Habits
Shows today's scheduled habits using the existing HabitDomain summary and Store logs. Habit history remains the existing domain action.

### Recent transactions
Uses the established shared `renderTransactionTable()` renderer and keeps all existing transaction action/data contracts intact.

## Architecture

No new backend endpoints were introduced.

The dashboard reads from:
- `VaultFlowStore.finance.transactions`
- `VaultFlowStore.finance.wallets`
- `VaultFlowStore.planning.goals`
- `VaultFlowStore.habits`
- `VaultFlowStore.intelligence`

Derived wallet balances continue to come from the established wallet derivation contract.

## Compatibility

- Phase 2 wallet contract preserved.
- Phase 3 habit report/integration contract preserved.
- Phase 4 intelligence dashboard contract preserved.
- Existing transaction renderer retained.
- Mobile navigation behavior retained.
- Existing CSS variables/theme system retained.

## Regression

Full `node tests/run-all.js`: PASS.

The Phase 4I live staging HTTP suite remains conditional because a staging URL was not configured in this environment.
