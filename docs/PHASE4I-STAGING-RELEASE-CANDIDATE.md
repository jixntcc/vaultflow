# Phase 4I — Staging & Release Candidate

## Current status

**CONDITIONAL PASS**

The RC artifact passes all repository/static checks and the complete regression suite. Live staging HTTP tests are intentionally skipped because `STAGING_BASE_URL` was not provided in this environment.

This is not a claim that production deployment has been tested.

## Automated RC checks

The command:

`npm run test:rc`

checks:
- Vercel build/route/cron configuration
- environment-only secret configuration
- absence of hard-coded JWT/MongoDB/cron secrets
- JWT algorithm, issuer, audience, subject and session-version contracts
- security headers
- JSON body limits and strict parsing
- API/auth rate-limit configuration
- proxy trust configuration
- JSON-only mutation policy
- production-safe JSON error normalization
- authorization/resource ownership contracts
- MongoDB transaction semantics
- sync idempotency and unique constraints
- automation trigger uniqueness
- index.html dependency references

## Live staging checks

Set:

- `STAGING_BASE_URL`
- `STAGING_TEST_USERNAME`
- `STAGING_TEST_PASSWORD`

Optional:

- `STAGING_CRON_SECRET`
- `STAGING_USER_A_TOKEN`
- `STAGING_USER_B_RESOURCE_ID`

Then run:

`STRICT_RC=1 npm run test:rc`

The live suite verifies:
1. `/health`
2. missing JWT rejection
3. security response headers
4. malformed JSON -> 400 JSON
5. non-JSON mutation -> 415
6. cron secret rejection
7. authenticated login
8. authenticated Vault read
9. logout/session revocation
10. cross-user resource denial when test vectors are supplied

`STRICT_RC=1` makes missing live staging checks fail the RC instead of returning conditional status.

## Manual release-gate tests

Before production:

### Authentication
- login with valid staging account
- invalid password
- expired/revoked session
- logout then replay token
- forgot-password flow
- reset-password flow
- rate-limit repeated login attempts

### Authorization
Create User A and User B resources.

Attempt from A:
- read B transaction
- edit B transaction
- delete B transaction
- read/edit/delete B vault
- read/edit/delete B goal
- read/edit/delete B habit
- write a habit log for B's habit
- use B's vault ID in A's transaction
- use B's push subscription endpoint
- submit B's resource ID through offline sync

Every cross-user mutation/read must be denied.

### Concurrency
Run two simultaneous requests using the same sync mutation key. Expected:
- exactly one domain mutation
- one `applied`
- one `already-applied` or `already-processing`
- no duplicate transaction

Run two automation workers with the same trigger key. Expected:
- exactly one trigger claim
- exactly one notification delivery

### Offline synchronization
Test:
- offline create -> reconnect -> sync
- retry same queue item
- two devices sync same key
- malformed queue item
- invalid parent resource
- expired/reclaimed processing lease
- failed mutation followed by retry

### Backup/restore
- backup a populated staging account
- delete/alter selected data
- restore
- verify transactions, vaults, goals, habits, habit logs
- verify automation rules
- verify notification settings/subscriptions according to restore contract
- verify no user ownership is changed by restore

### Production configuration
- `NODE_ENV=production`
- strong unique `JWT_SECRET`
- production `MONGODB_URI`
- exact `CORS_ORIGINS`
- `TRUST_PROXY=1` only when Vercel/proxy topology requires it
- production `PUBLIC_APP_URL`
- `CRON_SECRET`
- VAPID credentials if push is enabled
- no `.env` committed
- HTTPS enabled
- MongoDB indexes created

## Release decision

RC can move to production only when:
- automated regression = PASS
- live staging HTTP suite = PASS
- cross-user matrix = PASS
- concurrent sync test = PASS
- concurrent automation test = PASS
- backup/restore = PASS
- production environment variables verified
- no unresolved P0/P1 security defects

## Next phase

Do not perform broad product expansion during this gate.

After RC passes, proceed to the planned cleanup/refactor phase:
- extract remaining inline JavaScript from `public/index.html`
- preserve existing domain/store/API contracts
- add CSP after inline-script extraction
- keep the RC behavior as the regression baseline
