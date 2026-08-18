# Phase 5D — Goals Experience

## Status: IMPLEMENTED

Phase 5D upgrades Goals from a CRUD page into a goal-management experience while preserving the existing Goal model, authenticated API, Vault linkage, and Phase 4 projection engine.

## Experience

### Goal command center
The page now surfaces:
- total target value across active goals
- total funded amount and aggregate progress
- number of goals on track
- number of goals at risk

### Goal focus
VaultFlow selects the most useful goal to focus on using:
- risk state
- deadline proximity
- current projection

It then presents a next action or next milestone.

### Goal filters
- Active
- All
- Completed
- At risk

### Goal cards
Each goal shows:
- current amount / target
- progress
- remaining amount
- deadline state
- required monthly pace or projected contribution
- projected completion date
- next 25/50/75/100% milestone
- notes
- existing edit/delete actions

## Projection integrity

The existing Phase 4 `calculateGoalProjections()` engine remains the source of truth for projection data.

The UI does not invent a second projection algorithm. It adapts the existing projection read-model for presentation.

Goal create/update/delete operations refresh the intelligence snapshot so projections immediately reflect the mutation.

## Store

Goals now have an explicit Store contract:

- `VaultFlowStore.getGoals()`
- `VaultFlowStore.setGoals()`

The generic Store remains responsible only for state storage. Goal business logic remains outside the Store.

## Domain boundaries

Goals continue to reference Vaults through the existing ownership-safe API.

No new goal database model or endpoint was introduced.

## Compatibility

- Existing Goal CRUD endpoints preserved.
- Existing Vault ownership invariant preserved.
- Existing transaction edit/date contracts preserved.
- Existing Habit Store/domain contracts preserved.
- Existing Phase 4 intelligence contract preserved.
- Existing mobile/desktop page navigation preserved.

## Validation

- Phase 5D static assertions: PASS
- Full regression: PASS
- Phase 2/3/4/4H/4I suites: PASS
- Phase 5C assertions: PASS
- Live staging HTTP suite: still pending because `STAGING_BASE_URL` is not configured.
