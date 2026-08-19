# Phase 3B — Habit Store + Domain Engine

## Store

`VaultFlowStore.habits` remains the single frontend source of truth:

```text
habits.items
habits.logs
```

Added Store methods:

```javascript
getHabits()
setHabits()
getHabitLogs()
setHabitLogs()
addHabit()
addOrUpdateHabitLog()
removeHabitLog()
```

The generic Store remains responsible only for state storage and subscriptions. Habit business rules live in `HabitDomain`.

## Domain engine

Added:

```text
public/js/core/habit-domain.js
```

It is pure browser-side domain logic with no DOM and no network calls.

### Schedule engine

Supports:

- daily habits
- weekly habits with selected weekdays
- start/end dates

### Status engine

Returns:

```text
completed
skipped
missed
pending
not_scheduled
```

`missed` is derived when a scheduled past occurrence has no explicit completion/skip log.

### Streak engine

Daily:

```text
consecutive scheduled occurrences completed
```

Weekly:

```text
consecutive calendar weeks reaching targetPerWeek
```

### Completion rate

Calculated as:

```text
completed scheduled occurrences / scheduled occurrences
```

## Local-date safety

All calendar arithmetic uses validated `YYYY-MM-DD` date strings and UTC-midnight arithmetic internally. This avoids browser timezone offsets changing the calendar date.

`getTodayLocalDate()` uses the browser's local calendar date.

## View model

`buildHabitViewModel()` produces one shared UI contract for desktop and mobile.

Business actions are represented as capabilities:

```text
canComplete
canSkip
canEdit
canArchive
canViewHistory
```

The renderers should not implement their own habit rules.

## API integration

Added application-level Store helpers:

```javascript
loadHabits()
loadHabitLogs(habitId, { from, to })
```

No optimistic mutation has been introduced yet. Backend remains authoritative.

## Deliberate boundary

This phase does NOT add:

- Habit UI
- reminders
- push notifications
- complex recurrence
- financial integration
- reports
