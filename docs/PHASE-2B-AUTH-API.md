# Phase 2B — Authentication & API Migration

## Completed

### Authentication
- `checkAuth()` now hydrates `VaultFlowStore.auth`.
- Login and signup write authenticated user/session state to the store.
- Demo mode writes explicit `auth.mode = "demo"`.
- Logout and session invalidation clear the store.
- The app remains single-JWT based; refresh-token behavior is intentionally not enabled.

### API
- Production `apiCall()` now delegates to `VaultFlowApi.request()`.
- The old direct `fetch()` implementation has been removed from the application layer.
- Demo mode remains a local adapter and is explicitly separated from production transport.
- HTTP errors retain status/payload information.

### Desktop
- Added a standard desktop-density breakpoint for 1100–1599px viewports.
- The compact composition is reproduced at 100% CSS zoom rather than depending on browser zoom.
- Sidebar, typography, card density, table density and spacing are reduced.
- Six dashboard summary cards can occupy one row in the target desktop range.

## Why this approach

The reference screenshot at 67% browser zoom is effectively showing a larger CSS viewport and a more compact visual scale. Browser zoom should not be the product's design mechanism. The new breakpoint reproduces the desired density through layout values, while preserving normal 100% browser zoom and accessibility.

## Not yet migrated

- Domain data state (`transactions`, `vaults`, `goals`) still uses legacy globals.
- Demo API mutation parity is still incomplete.
- Full refresh-token architecture remains a separate security task.
