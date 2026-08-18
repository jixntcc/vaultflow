# Phase 7B — Habits Shared Mobile/Desktop Interaction Contract

## Status: IMPLEMENTED

Habits are now the third domain migrated to the Phase 7B interaction architecture.

## Contract

```text
Habit entity
   ↓
buildHabitViewModel()
   ↓
buildHabitActionContract()
   ↓
┌────────────────────┬────────────────────┐
│ Desktop renderer   │ Mobile renderer    │
└────────────────────┴────────────────────┘
```

## Entity → View Model

The raw Habit remains the domain entity.

`buildHabitViewModel()` delegates calculation to the existing `HabitDomain.buildHabitViewModel()` and normalizes the UI boundary.

It preserves:
- identity
- frequency
- status
- streak
- description/category
- completion/skip/edit/archive permissions

No Habit business rules were moved into the renderer.

## Action Contract

`buildHabitActionContract()` defines:
- complete
- skip
- history
- edit
- archive

Actions carry the same Habit ID and, where needed, the selected Habit date.

The existing Habit Domain remains authoritative for scheduling and completion semantics.

## Renderers

`renderHabitCard(viewModel, date, mode)` consumes the same View Model and Action Contract.

Desktop and mobile may compose controls differently, but both expose the same available domain actions.

## Event handling

All card actions use one delegated handler:

```text
[data-habit-action-type][data-habit-id]
```

Dispatch:
- complete → `setHabitOccurrence(id, date, completed)`
- skip → `setHabitOccurrence(id, date, skipped)`
- history → `openHabitHistory(id)`
- edit → `openHabitModal(id)`
- archive → `archiveHabit(id)`

Inline card action handlers were removed.

## Store

Habit Store now exposes:
- `getHabits`
- `setHabits`
- `addHabit`
- `updateHabit`
- `removeHabit`
- existing Habit log operations

This adds explicit mutation boundaries without replacing the existing Habit Domain engine.

## Archive behavior

Archive remains a server-authoritative operation.

After the API confirms the archive, the returned Habit is applied through:

`VaultFlowStore.updateHabit()`

Then the Habit list is rendered again.

Habit history remains preserved.

## Mobile UX

Habit actions use the Phase 7A touch baseline.

On small screens:
- Complete receives the full row
- secondary actions share a two-column layout
- action buttons remain at least 44px tall

## Validation

- Habit contract test: PASS
- Phase 3 Habit domain tests: PASS
- Phase 5C Finance + Habit regression: PASS
- Phase 7A Mobile Foundation: PASS
- Vault contract regression: PASS
- Goals contract regression: PASS
- Full regression: PASS
- PASS: 42
- SKIP: 1
- FAIL: 0

The remaining skip is the live staging HTTP suite because `STAGING_BASE_URL` is not configured.

## Next

Continue Phase 7B with Reports, then Intelligence and Settings.

The invariant remains:

`Entity → View Model → Action Contract → Desktop/Mobile UI`.
