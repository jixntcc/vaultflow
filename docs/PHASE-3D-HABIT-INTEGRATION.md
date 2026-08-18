# Phase 3D — Habit Integration & Persistence

## Persistence
- All Habit records and HabitLogs are loaded into the shared VaultFlowStore during startup.
- Added authenticated `GET /api/habit-logs` for complete log hydration.

## Backup / Restore
- JSON backups now include `habits` and `habitLogs`.
- Restore validates, maps source IDs to newly created Habit IDs, and restores logs after their parent habits.
- Existing HabitLogs are deleted before restore to prevent stale history from surviving.
- Demo mode supports habit backup/restore too.

## Integration
- Dashboard shows today's Habit progress.
- Reports includes a Habit Snapshot with active count, today completion, recent completion rate, and best streak.
- First-time-user detection recognizes existing habits.

## Design rule
Habit business logic remains in `HabitDomain`; the UI only renders the shared view model and persistence state.
