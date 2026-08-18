# Phase 7B — Settings Shared Mobile/Desktop Interaction Contract

## Status: IMPLEMENTED

Settings are now the sixth and final domain in the Phase 7B shared interaction audit.

## Contract

```text
Authenticated Settings entity/state
        ↓
buildSettingsViewModel()
        ↓
buildSettingsActionContract()
        ↓
┌────────────────────┬────────────────────┐
│ Desktop UI         │ Mobile UI          │
└────────────────────┴────────────────────┘
```

## Scope

Settings is intentionally treated as one domain with several sub-areas:
- Profile
- Plan
- Preferences
- Notifications
- Security
- Data & Backup
- About

The existing persistence and feature-specific services remain authoritative.

## View Model

`buildSettingsViewModel()` normalizes:
- username
- currency
- language
- theme
- date format
- notification preferences
- last backup
- PWA readiness

It does not move persistence or notification business rules into the renderer.

## Action Contract

`buildSettingsActionContract()` defines:
- change password
- plan
- logout all
- export CSV
- export PDF
- export backup
- restore backup
- privacy
- terms

The same action contract is available to desktop and mobile controls.

## Event handling

Settings actions use:

```text
[data-settings-action]
```

with one delegated handler.

Dispatch:
- change-password → `openChangePasswordFlow()`
- plan → `openPlanModal()`
- logout-all → existing placeholder
- export-csv → `exportTransactionsCsv()`
- export-pdf → `exportPdfReport()`
- export-backup → `exportBackupJson()`
- restore-backup → `openRestoreBackupPicker()`
- privacy → existing placeholder
- terms → existing placeholder

The primary Settings action controls no longer depend on inline `onclick` attributes.

## Store

Settings now exposes:
- `getSettings`
- `setSettings`

This is intentionally a thin state boundary. Existing backend/API persistence remains unchanged.

## Mobile behavior

The Settings page receives:
- a shared Backup/Restore action host
- 44px minimum touch targets for Settings actions
- full-width mobile action controls
- the existing settings rows remain responsive rather than being duplicated

## Important architectural constraint

Settings contains operations with different authority boundaries. Phase 7B does not fake new backend capabilities.

For example, “Logout All Devices” continues to use its existing prepared placeholder because backend support has not been implemented. The Action Contract standardizes invocation; it does not claim unsupported functionality exists.

## Validation

- Settings contract test: PASS
- Phase 6 account/plan regression: PASS
- Phase 7A Mobile Foundation: PASS
- Vault contract: PASS
- Goals contract: PASS
- Habits contract: PASS
- Reports contract: PASS
- Intelligence contract: PASS
- Full regression: PASS
- PASS: 42
- SKIP: 1
- FAIL: 0

The remaining skip is the live staging HTTP suite because `STAGING_BASE_URL` is not configured.

## Phase 7B result

The requested domain audit is complete:

`Entity / Read Model → View Model → Action Contract → Desktop/Mobile UI`

Domains:
- Transactions
- Vaults
- Goals
- Habits
- Reports
- Intelligence
- Settings
