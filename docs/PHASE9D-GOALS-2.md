# Phase 9D — Goals 2.0

## Status: IMPLEMENTED

Goals now act as a planning system rather than only a progress tracker.

## Backend projection expansion

The existing authenticated `/api/insights` and `/api/goals/projections` projection engine now returns:

- `monthlySurplus`
- `recommendedMonthlyContribution`
- `projectedCompletionDate`
- `conservativeCompletionDate`
- `deadlineFeasible`
- `deadlineBufferMonths`
- existing required pace and projected contribution

The recommended contribution deliberately uses approximately 80% of positive monthly surplus, leaving a buffer instead of assuming 100% of surplus can safely be allocated to a goal.

## Goals page

Added a Goal Plan section with:

- available cash-flow capacity
- total deadline pace
- recommended contribution capacity
- number of goals needing attention
- prioritized goal
- actionable planning recommendation

Each goal card now also shows:

- recommended pace
- deadline fit

## Architecture

The existing contract remains:

```text
Goal entity
  ↓
calculateGoalProjections()
  ↓
VaultFlowStore intelligence
  ↓
buildGoalViewModel()
  ↓
Goal action contract
  ↓
Desktop / Mobile
```

No second goal store or parallel projection engine was introduced.

## Product principle

The feature distinguishes:

- what the goal requires
- what current cash flow can support
- what a conservative contribution would be

It does not imply that all available surplus is automatically safe to commit.

## Validation

Focused Phase 9D test: PASS

Full `npm test`:
- PASS: 42
- SKIP: 1
- FAIL: 0

The known staging HTTP suite remains skipped because `STAGING_BASE_URL` is not configured.
