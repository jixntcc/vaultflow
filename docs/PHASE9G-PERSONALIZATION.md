# Phase 9G — Personalization

## Status: IMPLEMENTED

Phase 9G upgrades the existing personalization layer from a simple priority score into an explainable, confidence-aware recommendation model.

## Inputs

Personalization remains server-derived from the user's own data:

- financial health
- savings rate
- income/expense relationship
- expense growth
- active and at-risk goals
- goal deadline proximity
- habit completion
- habit ↔ finance observation quality
- recent transaction activity

No cross-user profile or external behavioral dataset is used.

## Output

The personalization profile now includes:

- `mode`
- `signals`
- `priorities`
- `headline`
- `message`
- `actionLabel`
- `actionPage`
- `confidence`
- `reasons`
- `secondaryFocus`
- `adaptive`
- `dataQuality`
- `behavioralSignal`

## Confidence

The recommendation is marked:

- `early` — insufficient history
- `high` — clear priority separation
- `medium` — useful but less decisive signal
- `balanced` — multiple areas have similar priority

This prevents the UI from presenting a weak recommendation as certainty.

## Explainability

The UI now answers:

**Why is this my focus?**

with concrete reasons such as:

- savings rate is low
- expenses exceed income
- a goal is at risk
- habit completion is weak
- spending is accelerating

## Adaptive flags

The server also provides bounded presentation hints:

- `showFinance`
- `showGoals`
- `showHabits`
- `emphasizeMomentum`

These are hints for the UI, not permissions and not a second source of truth.

## UX

Dashboard focus now displays the recommendation confidence.

The full personalization card displays:

- recommended focus
- confidence
- reason list
- signal bars
- behavioral signal
- existing action contract

Mobile actions retain 44px touch targets.

## Architecture

```text
Transactions ─┐
Goals ─────────┤
Habits ────────┤
Intelligence ──┤
               ↓
buildPersonalizationProfile()
               ↓
Personalization View Model
               ↓
VaultFlowStore.intelligence
               ↓
Dashboard / Insights
               ↓
Shared Action Contract
```

Personalization remains a derived read model. It does not mutate domain data.

## Validation

Focused Phase 9G test: PASS

Full `npm test`: PASS

- PASS: 42
- SKIP: 1
- FAIL: 0

The known staging HTTP suite remains skipped because `STAGING_BASE_URL` is not configured.
