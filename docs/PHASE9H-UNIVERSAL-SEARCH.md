# Phase 9H — Universal Search

## Status: IMPLEMENTED

Phase 9H completes the major Phase 9 search experience by providing one authenticated search surface across the user's core domains and derived intelligence.

## Searchable domains

- Transactions
- Vaults
- Goals
- Habits
- Automation rules
- Financial / behavioral intelligence

## Backend

`GET /api/search?q=...` remains authenticated.

The search snapshot is user-scoped:

```text
Transaction.find({ userId })
Vault.find({ userId })
Goal.find({ userId })
Habit.find({ userId })
HabitLog.find({ userId })
AutomationRule.find({ userId })
```

Derived intelligence is calculated only from this same user snapshot.

## Ranking

Search uses:

- exact match boost
- prefix boost
- phrase containment
- multi-term matching
- domain-specific base scores
- deterministic title tie-break

Results are capped at 30.

## UI

A persistent Search button is available on desktop and mobile.

Desktop:
- `Ctrl+K` / `Cmd+K`
- visible keyboard hint

Mobile:
- persistent touch-friendly Search control
- full-width search results
- compact result type indicator

The existing command palette is used rather than creating a second search UI.

## Result action contract

Search results continue through the shared action system.

The result carries:

- domain type
- entity id
- destination page
- action metadata

No inline handlers were introduced.

## Reliability

Search requests use a monotonically increasing request id so an older, slower response cannot overwrite a newer query.

## Security

Search never accepts a userId from the client.

The authenticated `req.user.userId` determines every queried collection.

No cross-user search is possible through the endpoint.

## Architecture

```text
User query
    ↓
Authenticated /api/search
    ↓
User-owned domain snapshot
    ↓
Derived intelligence snapshot
    ↓
searchAll()
    ↓
Ranked result View Models
    ↓
Shared action contract
    ↓
Existing domain UI
```

Universal Search is therefore a navigation/read capability, not a new domain.

## Validation

Focused Phase 9H test: PASS

Full `npm test`: PASS

All existing regression gates remain green.
