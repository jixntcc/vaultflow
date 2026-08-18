# Phase 7C — Shared UI Contract Enforcement & Cleanup

## Status: IMPLEMENTED

Phase 7C enforces the Phase 7B interaction architecture at the HTML entrypoint and adds regression protection against UI drift.

## 1. Inline JavaScript cleanup

`public/index.html` no longer contains inline event attributes.

Audit result:

```text
onclick                         0
other inline event attributes   0
javascript: URLs                0
```

The remaining UI behavior is expressed through data attributes and delegated handlers.

## 2. Generic UI action contract

Non-domain-specific controls now use:

```text
data-vf-action
```

with one delegated document-level dispatcher.

Current generic actions include:
- navigation
- modal opening/closing
- transaction/vault/goal creation
- habit modal/history navigation
- Intelligence refresh
- restore confirmation
- onboarding navigation/save actions
- automation rule toggle/delete
- command-palette result navigation

Action payloads are carried through explicit `data-vf-*` attributes instead of executable HTML strings.

## 3. Domain contracts remain separate

The generic dispatcher does not absorb domain business logic.

Existing Phase 7B contracts remain authoritative:

```text
Vault      → data-vault-action
Goals      → data-goal-action
Habits     → data-habit-action-type
Reports    → data-report-action
Intelligence → data-intelligence-action
Settings   → data-settings-action
```

This preserves the Entity → View Model → Action Contract boundary.

## 4. Dynamic HTML safety/maintainability

Removed executable action interpolation such as:

```javascript
onclick="${item.action}"
```

Dashboard focus items now carry a page payload:

```text
data-vf-action="switch-page"
data-vf-page="..."
```

Automation rules similarly carry rule IDs and enabled state as data.

This makes dynamic renderers produce data, not executable JavaScript.

## 5. Regression enforcement

Added:

`tests/phase7c-shared-ui-contract-check.js`

It fails if:
- inline event attributes return
- javascript URLs appear
- required generic action contracts disappear
- required action payloads are missing
- the delegated dispatcher is removed

## 6. Test reliability cleanup

The existing Phase 3B Habit test contained a hard-coded historical date:

`2026-08-17`

That became invalid as calendar time advanced because the Habit engine correctly changed the result from `pending` to `missed`.

The test now derives a future date from `getTodayLocalDate()`. No production Habit logic was changed.

## 7. Validation

Focused Phase 7C test: PASS

Full regression:

```text
PASS: 42
SKIP: 1
FAIL: 0
```

The remaining skip is the live staging HTTP suite because `STAGING_BASE_URL` is not configured.

RC status remains CONDITIONAL only because that live staging suite is not configured.

## Architectural result

Before:

```text
HTML
 ├── inline JavaScript
 ├── dynamic executable action strings
 ├── domain-specific handlers
 └── mobile/desktop-specific behavior
```

After:

```text
HTML
 ├── data-vf-action
 ├── domain action contracts
 └── semantic payloads
          ↓
   delegated handlers
          ↓
 domain functions / APIs
```

The Phase 7B contract is now actively enforced rather than merely documented.
