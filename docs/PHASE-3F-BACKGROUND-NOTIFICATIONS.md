# Phase 3F — Real Background Notification Infrastructure

## Architecture
Browser permission → Service Worker PushManager subscription → authenticated API → MongoDB PushSubscription → VAPID Web Push → Service Worker `push` event → OS notification.

## Backend
- `PushSubscription` stores one browser/device subscription per endpoint.
- `NotificationSettings` persists notification preferences server-side.
- `NotificationDelivery` provides per-device idempotency and removes stale 404/410 subscriptions.
- `/api/notifications/vapid-public-key` exposes only the public VAPID key.
- `/api/notifications/subscribe` registers/refreshes a device subscription.
- `/api/notifications/settings` persists preferences.
- `/api/cron/notifications` executes the background notification job and requires `CRON_SECRET`.

## Scheduler
`vercel.json` schedules the notification worker every minute. Vercel cron uses UTC, while each subscription stores the browser IANA timezone so habit reminder times are evaluated in the user's local timezone.

Vercel's current pricing rules matter: per-minute cron schedules require Pro or Enterprise; Hobby cron is limited to once per day. If VaultFlow is deployed on Hobby, the Web Push subscription layer still works, but minute-accurate scheduled reminders require upgrading the deployment plan or using an external scheduler such as QStash/Pipedream.

## Setup
1. Install dependencies: `npm install`.
2. Generate VAPID keys once: `npx web-push generate-vapid-keys`.
3. Put the public/private keys and `VAPID_SUBJECT` in environment variables. Never commit the private key.
4. Set a random `CRON_SECRET` in Vercel.
5. Deploy to production; Vercel cron jobs run only on production deployments.
6. Open VaultFlow, allow notifications, and the browser registers its PushSubscription.

## Delivery semantics
- Reminder: sent once per device per habit/date.
- Streak-risk: sent once per device per habit/date.
- Weekly summary: sent once per device per Sunday.
- 404/410 push endpoints are deleted automatically.
- Cron jobs are designed to be idempotent.

## Local testing
Set `CRON_SECRET` and call `GET /api/cron/notifications` with `Authorization: Bearer <CRON_SECRET>` while the app is running. For a real push test, use HTTPS (or localhost), a browser that supports PushManager, valid VAPID keys, and a logged-in account.
