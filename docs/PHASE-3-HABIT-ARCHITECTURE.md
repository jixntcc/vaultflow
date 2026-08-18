# VaultFlow 2.0 — Phase 3: Habit Tracking Architecture

## Status

Architecture and data-model design only. No Habit Tracking production UI/API/schema has been activated in this phase.

## Goal

Add Habit Tracking as a first-class VaultFlow domain without coupling it to the financial ledger.

The design must support:

- recurring habits
- daily/weekly schedules
- completion and skip states
- streaks
- historical logs
- missed days
- editing a habit without corrupting history
- archiving instead of destructive deletion
- reminders later
- mobile and desktop parity
- dashboard summaries
- reports
- backup/restore
- future analytics

---

# 1. Domain boundary

Habit Tracking is a separate domain:

```text
VaultFlowStore
│
├── auth
├── finance
│   ├── transactions[]
│   ├── vaults[]
│   └── wallets
│
├── planning
│   └── goals[]
│
├── habits
│   ├── items[]
│   └── logs[]
│
├── reports
├── preferences
└── ui
```

Habits must NOT directly mutate:

- transaction balances
- vault balances
- wallet balances
- goal balances

If a future feature wants a financial connection, it should create an explicit cross-domain event or reference rather than silently changing financial state.

---

# 2. Core entities

## Habit

A Habit is the definition/rule.

Example:

```text
Drink Water
Frequency: daily
Target: 1 completion per day
Status: active
```

A Habit is NOT a completion record.

## HabitLog

A HabitLog is the historical record for a specific scheduled occurrence.

Example:

```text
Habit: Drink Water
Date: 2026-08-16
Status: completed
CompletedAt: 08:30
```

This separation is critical.

```text
Habit
  ↓ defines the rule

HabitLog
  ↓ records what actually happened
```

---

# 3. Proposed Habit schema

```javascript
{
  _id,
  userId,

  name,
  description,

  category,

  color,
  icon,

  frequency: {
    type: "daily" | "weekly",
    daysOfWeek: [0,1,2,3,4,5,6],
    targetPerWeek: Number
  },

  startDate,
  endDate,

  preferredTime,

  reminder: {
    enabled,
    time
  },

  status: "active" | "paused" | "archived",

  createdAt,
  updatedAt
}
```

### Field rules

### `name`

Required.

Human-readable habit name.

### `description`

Optional.

### `category`

Optional initially.

Examples:

```text
Health
Fitness
Learning
Work
Finance
Personal
```

Categories should remain user-editable rather than hard-coded permanently.

### `icon`

Optional visual identifier.

Store a stable icon key, not arbitrary HTML.

### `color`

Optional UI token/key.

Do not store raw CSS.

### `frequency.type`

MVP supports:

```text
daily
weekly
```

Do not build monthly/custom recurrence until the core model is stable.

### `daysOfWeek`

Used for weekly habits.

Use:

```text
0 = Sunday
1 = Monday
...
6 = Saturday
```

For daily habits this can remain empty.

### `targetPerWeek`

For weekly habits.

Example:

```text
Exercise
weekly
targetPerWeek = 4
```

This means four completions during the week, not necessarily four consecutive days.

### `startDate`

Required.

The habit is not expected before this date.

### `endDate`

Optional.

If omitted, the habit has no planned end.

### `preferredTime`

Optional.

This is a preference/reminder reference, not proof of completion.

### `reminder`

Prepared for a future reminder system.

Do not implement push/email notifications in Phase 3.

### `status`

Use:

```text
active
paused
archived
```

Avoid hard deletion for normal user workflows.

---

# 4. Proposed HabitLog schema

```javascript
{
  _id,
  userId,
  habitId,

  scheduledDate,

  status: "completed" | "skipped" | "missed",

  completedAt,

  note,

  createdAt,
  updatedAt
}
```

## Why `scheduledDate` matters

A log belongs to the habit occurrence date, not merely the time the user clicked a button.

Example:

```text
User completes yesterday's habit today.

scheduledDate = 2026-08-15
completedAt   = 2026-08-16T08:20
```

This preserves the historical schedule.

---

# 5. Completion semantics

The MVP should have three states:

```text
completed
skipped
missed
```

### Completed

User intentionally completed the scheduled occurrence.

### Skipped

User intentionally says:

> I am not doing this occurrence.

A skipped occurrence should not be treated as a successful completion.

### Missed

The scheduled occurrence passed without completion or skip.

The UI may calculate missed status dynamically instead of creating millions of `missed` documents.

Recommended approach:

```text
Stored logs:
completed
skipped

Derived state:
missed
```

This reduces database noise.

---

# 6. Streak definition

Do not define streak as:

```text
number of consecutive HabitLog documents
```

Instead:

> A streak is the number of consecutive scheduled occurrences completed according to the habit's frequency rule.

For a daily habit:

```text
Mon ✓
Tue ✓
Wed ✓
Thu ✓
Fri ✗

Current streak = 0
Previous streak = 4
```

For a weekly 4x habit:

```text
Week:
Mon ✓
Tue ✗
Wed ✓
Thu ✓
Fri ✗
Sat ✓

4 completions
→ weekly target achieved
```

The streak algorithm must understand frequency.

---

# 7. Important rule: timezone

Habit dates must use the user's configured local timezone.

Do NOT calculate habit day boundaries using:

```javascript
new Date().toISOString().split('T')[0]
```

because that is UTC-based.

VaultFlow already encountered a similar date problem with transaction editing.

Habit Tracking should use a centralized local-date utility.

Recommended future utility:

```text
getUserLocalDate()
getUserLocalDateTime()
formatLocalDate()
```

The user's timezone should come from preferences/account configuration, with browser timezone as the initial fallback.

---

# 8. Habit editing semantics

This is critical.

Editing:

```text
Habit name
```

should update the Habit.

But editing:

```text
frequency
startDate
```

must NOT rewrite historical HabitLogs.

Example:

```text
August 1–10
Daily

August 11
Change to Mon/Wed/Fri
```

The old logs remain historical facts.

The new schedule applies from the appropriate effective date.

For MVP, the safest rule is:

> Schedule changes become effective from the current date forward.

Never rewrite historical completion data.

---

# 9. Archive instead of delete

Normal UI should use:

```text
Archive Habit
```

rather than destructive deletion.

Why?

Because:

```text
Habit
 ↓
historical logs
 ↓
streaks
 ↓
reports
```

Deleting the Habit can destroy valuable history.

If a permanent-delete function is eventually added, it should explicitly cascade/delete its logs and require strong confirmation.

---

# 10. API contract

Future endpoints:

```text
GET    /api/habits
POST   /api/habits
GET    /api/habits/:id
PUT    /api/habits/:id
DELETE /api/habits/:id
```

Logs:

```text
GET    /api/habits/:id/logs
POST   /api/habits/:id/logs
PUT    /api/habit-logs/:id
DELETE /api/habit-logs/:id
```

Dashboard summary:

```text
GET /api/habits/summary
```

Do not create all endpoints at once.

Implement the smallest useful contract first.

---

# 11. Store contract

The Store foundation already reserves:

```javascript
habits: {
  items: [],
  logs: []
}
```

Phase 3 defines their responsibility:

```text
habits.items
    = Habit definitions

habits.logs
    = loaded completion records
```

Recommended accessors:

```javascript
getHabits()
setHabits()

getHabitLogs()
setHabitLogs()
```

Derived selectors should eventually include:

```javascript
getHabitById(id)
getTodaysHabits()
getHabitStatus(habitId, date)
getHabitStreak(habitId)
getHabitCompletionRate(habitId, range)
```

Selectors should calculate data rather than creating competing state.

---

# 12. UI architecture

Desktop and mobile must use one Habit view model.

```text
Habit document
     ↓
buildHabitViewModel()
     ↓
┌──────────────┬──────────────┐
│ Desktop Card │ Mobile Card  │
└──────────────┴──────────────┘
       │
       ▼
Shared action contract
```

Actions:

```text
complete
skip
edit
archive
view history
```

No desktop-only or mobile-only business logic.

---

# 13. Dashboard integration

Do not immediately place every Habit metric on the financial dashboard.

Initial compact widget:

```text
Today's Habits

✓ Exercise
✓ Read
○ Meditation
○ Journal

3 / 4 completed
75%
```

The financial dashboard remains primarily financial.

A dedicated Habit dashboard/page should contain deeper statistics.

---

# 14. Reports

Future Habit reports can include:

```text
Completion rate
Current streak
Best streak
Weekly consistency
Monthly consistency
Most consistent habits
Most missed habits
```

Do NOT mix habit completion with financial income/expense calculations.

Reports may share the same reporting infrastructure but remain separate domains.

---

# 15. Backup / restore

Backup JSON should contain:

```json
{
  "version": 2,
  "habits": [],
  "habitLogs": []
}
```

Restore rules:

1. Validate schema version.
2. Validate Habit IDs.
3. Validate HabitLog `habitId` references.
4. Validate dates.
5. Validate enum values.
6. Prevent cross-user IDs from being trusted.
7. Import through the authenticated backend.

Never blindly insert uploaded JSON into MongoDB.

---

# 16. Habit-to-finance relationship

Do not automatically connect:

```text
Habit: Save ₹100/day
```

to:

```text
Transaction: ₹100
```

Those are different facts.

If a future version adds financial habits, create an explicit model such as:

```text
Habit goal
   ↓
optional financialGoalId
```

or an explicit event.

Never infer financial transactions from a completed habit without explicit user action.

---

# 17. MVP scope

Phase 3 MVP should contain:

### Habit definition

- create
- edit
- archive
- daily frequency
- weekly frequency
- start date
- optional end date
- category
- icon
- description

### Daily experience

- today's habits
- complete
- skip
- status
- progress

### History

- calendar/history
- completion records
- streak

### Store

- habits
- logs
- selectors

### Backup

- export
- restore validation

---

# 18. Explicitly out of MVP

Do NOT build these yet:

```text
AI habit recommendations
social sharing
leaderboards
gamification economy
complex recurrence rules
monthly schedules
multiple completions per day
push notifications
email reminders
wearable integrations
calendar integrations
financial automation
```

These can create unnecessary complexity before the core model is proven.

---

# 19. Phase 3 success criteria

Before coding the UI, the following must be true:

```text
✓ Habit definition is separate from HabitLog
✓ Historical logs survive habit edits
✓ Archived habits preserve history
✓ Daily and weekly frequency semantics are explicit
✓ Streak calculation is deterministic
✓ Local timezone handling is centralized
✓ Store has one source of truth
✓ Desktop/mobile share one action contract
✓ Backup schema is versioned
✓ Logs cannot belong to another user's habit
✓ Habit state cannot silently mutate financial state
```

Once these are satisfied, implementation can begin safely.
