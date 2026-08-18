# Phase 7B — Vaults Shared Mobile/Desktop Interaction Contract

## Status: IMPLEMENTED

Vaults are the first domain migrated to the Phase 7B interaction architecture.

## Contract

```text
Vault entity
   ↓
buildVaultViewModel()
   ↓
buildVaultActionContract()
   ↓
┌────────────────────┬────────────────────┐
│ Desktop renderer   │ Mobile renderer    │
│ renderVaultDesktop │ renderVaultMobile  │
└────────────────────┴────────────────────┘
```

## Entity

The source remains the authenticated Vault domain entity returned by the API and stored in `VaultFlowStore.finance.vaults`.

No new backend Vault model was introduced.

## View Model

`buildVaultViewModel(vault)` normalizes:
- id
- name
- description
- percentage
- totalIncome
- totalSpent
- balance

Presentation code does not need to know the raw API shape.

## Action Contract

`buildVaultActionContract(viewModel)` currently defines:
- edit
- delete

Both actions carry the same Vault ID and are rendered identically at the contract level for desktop and mobile.

## Renderers

Desktop:
`renderVaultDesktop(viewModel)`

Mobile:
`renderVaultMobile(viewModel)`

Both consume the same View Model and Action Contract.

The visual composition is allowed to differ; domain behavior is not.

## Event handling

Vault actions use one delegated document-level handler:

```text
[data-vault-action][data-vault-id]
```

The handler dispatches to the existing:
- `editVault(id)`
- `deleteVault(id)`

This avoids inline action logic being duplicated between renderers.

## Store

VaultFlowStore now owns an explicit Vault domain contract:
- `getVaults`
- `setVaults`
- `upsertVault`
- `removeVault`

The existing application-level `getVaults`/`setVaults` helpers now delegate to these Store APIs.

## Mutation behavior

The API remains authoritative.

After create/update:
- API mutation executes
- Vault list is reloaded
- Store is refreshed

After delete:
- Store removes the entity immediately
- API reload then confirms the authoritative list

No optimistic backend assumption was introduced.

## Mobile UX

Vault action controls use the Phase 7A touch baseline:
- minimum 44px action height
- two-column mobile edit/delete layout
- no page-level horizontal overflow

## Regression

- Phase 2D Vault migration test: PASS
- Phase 7B Vault contract test: PASS
- Full regression: PASS
- PASS: 42
- SKIP: 1
- FAIL: 0

The existing live staging HTTP suite remains skipped because `STAGING_BASE_URL` is not configured.

## Next

Repeat the same audit for Goals, then Habits, Reports, Intelligence, and Settings.

Do not force identical visual markup across domains. The invariant is the shared architectural contract:

`Entity → View Model → Action Contract → Desktop/Mobile renderers`.
