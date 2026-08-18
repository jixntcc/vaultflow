# Phase 4H-1B — Cross-User Authorization Attack Matrix

## Result

**PASS for the available automated authorization contract tests.**

The test suite verifies that ownership decisions derive from the authenticated JWT user identity rather than caller-supplied identifiers.

## Runtime contract vectors

A deterministic in-memory authorization model was used because the QA environment does not contain a MongoDB server or `mongodb-memory-server`.

### Baseline

- User A → User A resource: **ALLOW**

### Cross-user attempts

Both directions were tested:

- User A → User B transaction: **DENY**
- User B → User A transaction: **DENY**
- User A → User B vault: **DENY**
- User B → User A vault: **DENY**
- User A → User B goal: **DENY**
- User B → User A goal: **DENY**
- User A → User B habit: **DENY**
- User B → User A habit: **DENY**
- User A → User B habit log: **DENY**
- User B → User A habit log: **DENY**
- User A → User B automation rule: **DENY**
- User B → User A automation rule: **DENY**
- User A → User B audit event: **DENY**
- User B → User A audit event: **DENY**
- User A → User B notification settings: **DENY**
- User B → User A notification settings: **DENY**
- User A → User B push subscription: **DENY**
- User B → User A push subscription: **DENY**

## Static route matrix

Verified that protected routes use `authenticateToken`, including:
- vaults
- transactions
- goals
- habits
- habit logs
- notifications
- insights
- projections
- search
- audit
- automation
- sync
- analytics

Resource routes use authenticated-user ownership constraints.

Nested resource checks were also verified:
- offline habit log creation checks the habit owner
- offline transaction creation checks the vault owner
- push subscriptions reject cross-account endpoint reassignment

No protected route uses `req.body.userId` or `req.query.userId` as the ownership authority.

The cron notification endpoint is intentionally not JWT-authenticated; it is guarded by `CRON_SECRET`.

## Important limitation

This is not a full live HTTP/MongoDB penetration test. No MongoDB runtime is available in the current environment.

Before production release, run the same matrix against a staging MongoDB using two real accounts and real HTTP requests. That final test should cover:
- GET
- POST
- PUT
- DELETE
- nested resources
- ID substitution
- malformed IDs
- replayed requests
- concurrent requests

## Release gate

The authorization matrix should remain a mandatory regression test for every future VaultFlow release.
