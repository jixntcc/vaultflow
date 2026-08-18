# Phase 8E — Observability & Performance Baseline

## Status: IMPLEMENTED

Phase 8E adds lightweight operational insight without creating a large admin subsystem.

## Server observability

### `/health`

Liveness + release identity.

### `/health/ready`

Readiness + MongoDB connectivity.

### `/health/metrics`

Opt-in aggregate diagnostics.

Enable with:

```text
OBSERVABILITY_ENABLED=1
```

It reports:
- process uptime
- request count
- response count
- 4xx/5xx status distribution
- error rate
- slow-request count
- average response duration
- requests/minute
- aggregate route metrics
- last few sanitized error records

It deliberately does **not** expose:
- request bodies
- JWTs
- passwords
- database URLs
- email credentials
- VAPID private keys
- IP addresses
- user IDs
- financial records

Because VaultFlow may run on Vercel/serverless infrastructure, these metrics are intentionally treated as **instance-local diagnostics**, not a durable analytics database.

## Request performance

Every response receives:

```text
Server-Timing: app;dur=<milliseconds>
```

Requests slower than `SLOW_REQUEST_MS` (default 750ms) are logged as `[SLOW]`.

Route metrics track:
- request count
- error count
- slow count
- average duration

## Client performance

The browser now exposes a diagnostic-only helper:

```javascript
getClientPerformanceSnapshot()
```

It uses the browser Performance API to capture:
- DOMContentLoaded timing
- load timing
- response timing
- navigation transfer size
- resource count/transfer size
- viewport dimensions
- device pixel ratio

It does not send this data anywhere automatically.

## Baseline targets

These are engineering targets, not claims about current production performance:

| Metric | Target |
|---|---:|
| `/health` | <100ms |
| Simple authenticated API | <300ms |
| Dashboard API bundle | <750ms |
| Report generation | <1500ms |
| Restore | <5000ms for normal personal dataset |
| Client DOMContentLoaded | <1500ms |
| Client load | <2500ms |

Real measurements should be captured from staging before using them as commitments.

## Recommended measurement process

1. Deploy the current release candidate to staging.
2. Enable diagnostics temporarily.
3. Run the Phase 8C device matrix.
4. Capture:
   - `/health`
   - `/health/ready`
   - representative API timings
   - browser performance snapshots
5. Record results against the baseline table.
6. Disable diagnostics again unless actively needed.

## Production principle

Do not turn `/health/metrics` into a public analytics endpoint.

For a future multi-user deployment, durable observability should use an external telemetry provider or a server-side metrics store with explicit retention and privacy controls.

Phase 8E deliberately avoids adding that operational dependency now.
