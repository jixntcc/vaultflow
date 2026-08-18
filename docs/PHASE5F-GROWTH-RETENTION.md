# Phase 5F — Growth / Retention

## Status: IMPLEMENTED

Phase 5F turns the existing Finance, Goals, Habits, and Personalization signals into a restrained retention layer.

The objective is not notification spam or gamification. It is to give users a reason to return because VaultFlow becomes more useful with continued, natural use.

## Retention read-model

`buildRetentionProfile()` produces:
- state: new / developing / engaged / at-risk
- activityScore
- activity streak
- weekly review
- recent goal milestones
- personalized action
- data-quality metadata
- privacy contract

## Weekly Review

The Dashboard now exposes a compact weekly-review prompt.

It summarizes:
- active days in the last 7 days
- transactions
- habit completion
- current activity streak

The Intelligence page provides the expanded weekly review.

## Milestones

Goal progress can produce milestone signals at:
- 25%
- 50%
- 75%

Milestones are derived only from current goal state. They do not create a new persistent notification system.

## Engagement states

### New
No meaningful activity exists yet.

### Developing
The user has started building a pattern, but activity is inconsistent.

### Engaged
Recent activity is consistent enough for VaultFlow's intelligence to become increasingly useful.

### At risk
Recent activity is quiet. The product recommends a small restart rather than asking the user to catch up.

## Anti-spam principle

Phase 5F deliberately does NOT introduce:
- automatic daily nagging
- streak-loss warnings
- manipulative countdowns
- unnecessary push notifications
- artificial points or badges
- cross-user comparison

The retention mechanism is product value: weekly reflection, visible progress, and useful next actions.

## Domain integrity

Retention is derived intelligence only.

It does not mutate:
- transactions
- vaults
- goals
- habits
- automation rules

It is stored in the existing intelligence coordination state through `VaultFlowStore.setRetention()`.

## Validation

- Phase 5F static assertions: PASS
- Retention engine smoke test: PASS
- Full regression: PASS
- Phase 2/3/4/4H/4I suites: PASS
- Phase 5C/5D/5E suites: PASS
- Live staging HTTP suite: still pending because `STAGING_BASE_URL` is not configured.
