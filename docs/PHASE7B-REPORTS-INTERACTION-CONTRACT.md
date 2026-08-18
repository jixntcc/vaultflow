# Phase 7B — Reports Shared Mobile/Desktop Interaction Contract

## Status: IMPLEMENTED

Reports are now the fourth domain migrated to the Phase 7B interaction architecture.

## Contract

```text
Analytics/report entity (read model)
   ↓
buildReportViewModel()
   ↓
buildReportActionContract()
   ↓
┌────────────────────┬────────────────────┐
│ Desktop controls   │ Mobile controls    │
└────────────────────┴────────────────────┘
```

## Entity

Reports are a read-only projection of authenticated transaction data.

No new report persistence model was introduced.

The authoritative source remains:
- authenticated transaction data
- `/api/analytics/full`
- existing `buildAnalyticsFromTransactions()`

## Store

The existing `reports` Store branch is now explicitly exposed through:
- `getReports`
- `setReports`
- `setReportsLoading`

The API result is written into the Store.

Filtering uses the Store report read model as a fallback when the local report variable is unavailable.

## View Model

`buildReportViewModel(data, preset)` normalizes:
- selected period
- income
- expenses
- net savings
- savings rate
- monthly data
- category breakdown
- Vault breakdown
- savings portfolio
- income category breakdown

The analytics calculation itself is unchanged.

## Action Contract

`buildReportActionContract()` defines:
- toggle filters
- apply filters
- refresh
- open habits (reserved for the existing Habit Snapshot surface)

The current rendered toolbar uses the filter/apply/refresh actions.

## Event handling

Report controls use:

```text
[data-report-action]
```

with one delegated handler.

Dispatch:
- toggle-filters → `toggleReportFilters()`
- apply-filters → `applyReportFilters()`
- refresh → `loadReports()`

The filter toggle and Apply controls no longer depend on inline `onclick` attributes.

## Desktop/mobile behavior

The same Report action contract is rendered in both modes.

Desktop:
- compact horizontal action row

Mobile:
- full-width two-column touch-friendly action controls

The report charts remain the same visual components; this phase changes the interaction/data boundary rather than rewriting Chart.js rendering.

## Mobile UX

Report controls use the Phase 7A touch baseline:
- minimum 44px controls
- no page-level horizontal overflow
- filter toggle remains touch accessible

## Validation

- Reports contract test: PASS
- Phase 5/finance/report regression: PASS
- Phase 7A Mobile Foundation: PASS
- Vault contract: PASS
- Goals contract: PASS
- Habits contract: PASS
- Full regression: PASS
- PASS: 42
- SKIP: 1
- FAIL: 0

The remaining skip is the live staging HTTP suite because `STAGING_BASE_URL` is not configured.

## Next

Continue Phase 7B with Intelligence, then Settings.

The invariant remains:

`Entity → View Model → Action Contract → Desktop/Mobile UI`.
