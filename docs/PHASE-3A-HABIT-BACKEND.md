# Phase 3A — Habit Backend Data Layer

## Implemented

### MongoDB models

- `Habit`
- `HabitLog`

### Habit ownership

Every Habit has a required `userId`.

Every HabitLog has both:

- `userId`
- `habitId`

Every route verifies that the referenced Habit belongs to the authenticated user before reading or mutating its logs.

### Indexes

Habit:

```text
{ userId: 1, status: 1, createdAt: -1 }
```

HabitLog:

```text
{ userId: 1, habitId: 1, scheduledDate: 1 } UNIQUE
{ userId: 1, scheduledDate: 1 }
```

The unique HabitLog index prevents two records for the same user's habit and scheduled date.

## API

```text
GET    /api/habits
GET    /api/habits/:id
POST   /api/habits
PUT    /api/habits/:id
DELETE /api/habits/:id       # archives; does not destroy history

GET    /api/habits/:id/logs
POST   /api/habits/:id/logs
PUT    /api/habit-logs/:id
DELETE /api/habit-logs/:id

GET    /api/habits/summary
```

All Habit endpoints require the existing JWT authentication middleware.

## Validation

- Habit name required.
- Date fields use `YYYY-MM-DD` local-date strings.
- Date values are calendar-validated, not merely regex-validated.
- Daily habits cannot specify weekly days/target.
- Weekly target is 1–7 and cannot exceed selected weekdays.
- Reminder time is validated as `HH:mm`.
- Habit logs only accept explicit `completed` or `skipped` states.
- `missed` remains a model-level state for future derived/import use; the normal API does not create missed records.
- A log date must fall within the habit's start/end range.
- Habit updates do not modify historical logs.

## Archive behavior

`DELETE /api/habits/:id` is intentionally an archive operation.

It sets:

```text
status = archived
```

and preserves all logs.

Hard deletion is not part of the Phase 3A user workflow.

## Not implemented yet

- streak calculation
- schedule eligibility engine
- missed-day derivation
- reminder delivery
- Habit UI
- Store integration
- backup/restore integration
- browser/E2E tests
