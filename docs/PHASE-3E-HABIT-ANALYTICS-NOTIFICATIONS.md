# Phase 3E — Habit Analytics & Notifications

## Analytics
- 30/60/90-day portfolio analytics
- Per-habit completion rate
- Completed/skipped/missed/pending counts
- Daily consistency series
- Weekday performance
- Consistency score
- Current/best streaks
- Habit ranking

## Notifications
- Habit reminder at configured local reminder time
- Streak-risk nudge for active streaks still pending
- Weekly habit summary
- Existing finance notifications preserved
- Deduplication keys prevent repeated reminders
- Service-worker notification tags are now per-notification

## Delivery boundary
The current implementation is a local notification engine. It evaluates reminders when VaultFlow is open (on startup, after preference changes, and once per minute while the app is active). It does not claim true background scheduling after the browser/PWA process is completely stopped. True closed-app reminders require Web Push subscriptions and a server-side scheduler, which is intentionally left for the next notification infrastructure phase.
