# Notification Infrastructure 2.0

## Scheduler model

VaultFlow keeps the notification endpoint on Vercel but removes Vercel's native Cron configuration.

```text
cron-job.org
    |
    | GET /api/cron/notifications
    | Authorization: Bearer <CRON_SECRET>
    | every minute
    v
Vercel
    |
    +-- runBackgroundNotificationJob()
    +-- evaluateAutomationRules()
    v
MongoDB + Web Push
```

Vercel Hobby native Cron is intentionally not used because its current scheduling limit is once per day. An external scheduler is therefore responsible for minute-level execution.

## Endpoint authentication

The endpoint accepts:

```http
Authorization: Bearer <CRON_SECRET>
```

`CRON_SECRET` must remain a Vercel Production environment variable.

Do not put the secret in the URL or query string.

cron-job.org supports arbitrary custom HTTP headers, so configure the `Authorization` header directly in the cron job.

## Current background notification contract

### Finance

- `dailyReminder`: once per local day after 18:00.
- `weeklySummary`: Sunday after 18:00 in the subscription timezone.
- `savingsInsights`: once per local day after 18:00 when positive savings and income exist.

### Habits

- `habitReminder`: after each configured habit reminder time while the habit remains pending.
- `habitRisk`: protects an active streak of at least two days.
- `habitWeeklySummary`: Sunday after 18:00.

The minute scheduler does not imply minute-level delivery duplication. Each notification uses a deterministic occurrence key.

## Idempotency

`NotificationDelivery` keeps a unique index on:

```text
userId + subscriptionId + key
```

A successful claim prevents another overlapping scheduler invocation from sending the same occurrence.

Failed deliveries can be atomically reclaimed on a later invocation. This avoids permanently blocking retries after a transient Web Push failure while still preventing concurrent duplicate sends.

## Observability

Each cron execution emits:

```text
[NotificationCron] started <timestamp>
[NotificationCron] finished <timestamp> configured=true checked=N sent=N skipped=N failed=N
```

Subscription-level failures log only the subscription ID and error message. Secrets are never logged.

## cron-job.org configuration

Recommended job:

```text
Title:
VaultFlow Notifications

Method:
GET

URL:
https://<production-domain>/api/cron/notifications

Schedule:
Every minute

Header:
Authorization: Bearer <CRON_SECRET>
```

Use cron-job.org's test execution before enabling the recurring job.

The expected authenticated response is HTTP 200 with:

```json
{
  "ok": true,
  "configured": true,
  "checked": 1,
  "sent": 0
}
```

Exact counts depend on the current users/subscriptions.

## Deployment order

1. Deploy the version with native Vercel Cron removed.
2. Confirm the production deployment is healthy.
3. Configure the cron-job.org request with the production URL and Authorization header.
4. Run one manual test execution.
5. Confirm HTTP 200.
6. Confirm Vercel logs show `[NotificationCron] started` and `[NotificationCron] finished`.
7. Enable the every-minute schedule.
8. Verify one real habit reminder and one finance notification.
9. Confirm duplicate executions do not create duplicate deliveries.

## Important limitation

cron-job.org has a 30-second request timeout. The current job should therefore remain lightweight and batch-friendly. The implementation now caches per-user settings/transaction/habit context within a single run, reducing repeated database reads across multiple device subscriptions.

For much larger user counts, the next architectural step should be a queued/due-notification model rather than increasing scheduler frequency or repeatedly scanning every subscription.
