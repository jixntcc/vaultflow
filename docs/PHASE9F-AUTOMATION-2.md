# Phase 9F — Automation 2.0

## Status: IMPLEMENTED

Automation now consumes the intelligence signals introduced through Phases 9C–9E while preserving the existing authenticated rule model and durable trigger infrastructure.

## New automation events

- `financial_health_drop` — trigger when financial health is at/below a configured score
- `savings_rate_below` — trigger when savings rate is at/below a configured percentage
- `habit_finance_signal` — trigger when the observed habit-completion/spending difference reaches a configured threshold after at least 7 observed days

Existing events remain:
- goal at risk
- daily expense threshold
- habit streak
- weekly summary

## Duplicate-trigger hardening

The existing `AutomationTrigger` collection remains the durable idempotency boundary.

Phase 9F replaces the previous hourly trigger key with semantic occurrence keys:

```text
Daily conditions
  automation:<rule>:<date>

Weekly summary
  automation:<rule>:week:<year>-<week>

Habit streak
  automation:<rule>:habit:<habitId>:<date>

Habit ↔ finance
  automation:<rule>:habit-finance:<date>
```

Because `(ruleId, key)` is unique, concurrent scheduler runs cannot deliver the same semantic occurrence twice.

The existing processing lease/reclaim mechanism remains intact.

## Ownership

Automation rules remain user-scoped at every API operation:

```text
GET    /api/automation/rules
POST   /api/automation/rules
PUT    /api/automation/rules/:id
DELETE /api/automation/rules/:id
```

No cross-user rule access is introduced.

## UI

The Automation 2.0 form now exposes all seven supported event types and preserves the selected delivery mode.

Rule rows show human-readable event names and configured thresholds.

The UI also explains that each scheduler occurrence is protected against duplicate delivery.

## Architecture

```text
Transactions ─┐
Goals ─────────┤
Habits ────────┤
Intelligence ──┤
               ↓
       Automation evaluator
               ↓
       Rule condition engine
               ↓
     Semantic occurrence key
               ↓
       AutomationTrigger
          unique claim
               ↓
       Push / In-app action
```

Automation remains an action layer over existing domain/intelligence data. It does not become a second source of truth.

## Validation

Focused Phase 9F test: PASS

Full `npm test`: PASS

- PASS: 42
- SKIP: 1
- FAIL: 0

The known staging HTTP suite remains skipped because `STAGING_BASE_URL` is not configured.
