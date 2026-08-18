# Habit Store Contract

The existing Store reservation is:

```javascript
habits: {
  items: [],
  logs: []
}
```

Phase 3 gives it this contract:

## State

```text
habits.items
  Habit[]

habits.logs
  HabitLog[]
```

## Mutators

```javascript
getHabits()
setHabits(nextHabits)

getHabitLogs()
setHabitLogs(nextLogs)
```

## Derived selectors

```javascript
getHabitById(id)
getTodaysHabits(localDate)
getHabitLog(habitId, scheduledDate)
getHabitStatus(habitId, scheduledDate)
getHabitStreak(habitId, asOfDate)
getHabitCompletionRate(habitId, fromDate, toDate)
```

Selectors should be pure where practical:

```text
Store state
   ↓
selector
   ↓
derived result
```

They should not mutate Store state.

## Mutation rule

Completing a habit changes `habits.logs`.

It does not change:

```text
finance.transactions
finance.vaults
finance.wallets
planning.goals
```

## Async rule

API mutations should:

1. send the command to the backend
2. receive the authoritative document
3. update the Store
4. re-render through the shared view model

Avoid optimistic mutation until the basic implementation is stable.
