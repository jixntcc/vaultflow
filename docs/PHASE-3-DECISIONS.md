# Phase 3 — Architectural Decisions

1. Habit and HabitLog are separate entities.
2. Missed status is derived where possible; only explicit completion/skip needs storage.
3. Daily and weekly schedules are MVP recurrence types.
4. Schedule changes do not rewrite historical logs.
5. Archive is the normal deletion behavior.
6. Habit dates use user-local calendar semantics.
7. Habit state is isolated from the financial ledger.
8. Desktop and mobile consume the same HabitViewModel and action contract.
9. Backup is versioned and validated.
10. Notifications are designed as fields now but implemented later.
11. No AI/gamification/social layer in the first Habit release.
