# Phase 7B — Goals Shared Mobile/Desktop Interaction Contract

## Status: IMPLEMENTED

Goals are now the second domain migrated to the Phase 7B interaction architecture.

## Contract

```text
Goal entity
   ↓
buildGoalViewModel()
   ↓
buildGoalActionContract()
   ↓
shared Goal card
   ↓
Desktop / Mobile composition
```

## Entity → View Model

`buildGoalViewModel(goal)` combines the raw Goal entity with the existing, authoritative `goalProjectionFor(goal)` read model.

It normalizes:
- id
- name
- notes
- current
- target
- remaining
- progress percentage
- status
- deadline label
- pace text
- projected completion text
- next milestone

The projection algorithm itself was not changed. Phase 7B only moves its presentation boundary.

## Action Contract

`buildGoalActionContract(viewModel)` defines:
- open
- edit
- delete

The Focus card's `Open goal` action also uses the same `open` contract rather than an inline `editGoal()` call.

This keeps the focus surface and list surface on the same action model.

## Renderers

The same `renderGoalCard(viewModel, mode)` consumes the normalized View Model and Action Contract.

- desktop uses the established card composition
- mobile uses a compact action composition
- both expose the same actions

The visual structure can diverge without allowing domain behavior to diverge.

## Event handling

All Goal actions use one delegated handler:

```text
[data-goal-action][data-goal-id]
```

Dispatch:
- `open` → `editGoal(id)`
- `edit` → `editGoal(id)`
- `delete` → `deleteGoal(id)`

Inline action handlers were removed from the Goal cards and focus action.

## Store

Goal Store now exposes:
- `getGoals`
- `setGoals`
- `upsertGoal`
- `removeGoal`

The existing Goal business/projection logic remains outside the generic Store.

## Mutation behavior

The API remains authoritative.

Delete:
1. API DELETE
2. Store removes the entity
3. authoritative Goal list reloads

Create/update continue through the existing API and reload path.

No new Goal backend model or projection algorithm was introduced.

## Mobile UX

Goal actions use the Phase 7A touch baseline:
- minimum 44px action height
- Open action receives the full row on small screens
- Edit/Delete share the second row
- no page-level horizontal overflow introduced

## Validation

- Goal contract test: PASS
- Phase 5D Goals regression: PASS
- Vault contract regression: PASS
- Full regression: PASS
- PASS: 42
- SKIP: 1
- FAIL: 0

The remaining skip is the live staging HTTP suite because `STAGING_BASE_URL` is not configured.

## Next

Continue Phase 7B with Habits, then Reports, Intelligence, and Settings.

The invariant remains:

`Entity → View Model → Action Contract → Desktop/Mobile UI`.
