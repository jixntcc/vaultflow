# Phase 3G — Habit UX Polish & Reliability

## UX
- Added responsive notification/reminder status banner.
- Added online/offline sync indicator.
- Added loading/disabled states for Complete/Skip actions.
- Added duplicate-click protection.
- Added explicit offline-save guard (no false local success).
- Added success/error feedback for habit mutations.
- Reconciles push subscription when the page becomes visible again.
- Handles denied/unsupported notification states.

## Push reliability
- Re-syncs an existing PushSubscription with the backend.
- Tracks a local subscription hash to avoid unnecessary repeated registration.
- Adds notification click fallback behavior in the service worker.
- Adds a pushsubscriptionchange hook; foreground reconciliation remains the source of truth.

## Important
Offline mutations are intentionally NOT queued in Phase 3G. This prevents claiming a habit was saved when the backend has not accepted it. An offline mutation queue should be a separate transaction-safe phase.
