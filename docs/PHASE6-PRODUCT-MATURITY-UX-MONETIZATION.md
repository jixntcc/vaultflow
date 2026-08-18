# Phase 6 — Product Maturity / UX & Monetization

## Status: IMPLEMENTED

Phase 6 moves VaultFlow from feature-complete architecture toward a product-ready experience.

The implementation is deliberately conservative: it improves activation and monetization readiness without changing the established Finance, Vault, Goal, Habit, Intelligence, Sync, or Authorization contracts.

## 6A — Activation / UX maturity

The Dashboard now includes a lightweight activation checklist when the account is still establishing its baseline:
- add first transaction
- create a vault
- set a goal
- start a habit

The checklist disappears naturally once the user has enough activity.

This is derived from existing Store state and creates no new domain data.

## 6B — Account plan / monetization foundation

A billing-ready plan registry now exists:

### Free
- Transactions
- Vaults
- Goals
- Habits
- Basic intelligence

### VaultFlow Plus
- Everything in Free
- Advanced intelligence
- Automation
- Background notifications
- Advanced exports

The current implementation does NOT take payment.

`billingProvider` remains null until a real payment provider, pricing, tax, refund, and subscription lifecycle policy are selected.

This prevents a fake or incomplete billing implementation from being treated as production billing.

## User account fields

The User model now supports:
- subscriptionPlan
- subscriptionStatus
- subscriptionUpdatedAt

Existing accounts safely default to:
- `free`
- `active`

## API

New authenticated read-only endpoint:

`GET /api/account/plan`

The existing `/api/insights` response also contains the current plan profile.

## Settings UX

Settings now contains a VaultFlow Plan card showing:
- current plan
- entitlement list
- upgrade state

A pricing modal explains the Free vs Plus boundary and explicitly states that payment integration is not yet connected.

## 6C — Product positioning

Core financial records are not artificially paywalled.

The proposed premium boundary is convenience and advanced intelligence rather than access to the user's own data.

This leaves the product usable on Free while giving Plus a legitimate value proposition.

## Architecture

```text
User
 ↓
Plan profile
 ↓
Entitlement read-model
 ↓
UI presentation / future feature gates

Finance / Goals / Habits remain independent domains.
```

No payment provider or client-controlled subscription mutation was introduced.

## Security

Users cannot change their plan through the client.

The plan endpoint reads subscription state from the authenticated User record.

The existing JWT, ownership, rate-limit, sync, and authorization architecture remains unchanged.

## Validation

- Phase 6 static assertions: PASS
- Plan registry smoke test: PASS
- Full regression: PASS
- Phase 2/3/4/4H/4I suites: PASS
- Phase 5C/5D/5E/5F suites: PASS
- Live staging HTTP suite: still pending because `STAGING_BASE_URL` is not configured.

## Deferred before real monetization

A production billing implementation should be a separate phase after:
1. final pricing decision
2. payment provider selection
3. India GST/tax treatment
4. refund/cancellation policy
5. webhook signature validation
6. subscription lifecycle reconciliation
7. invoice/receipt handling
8. entitlement downgrade/expiry tests

Do not treat the Phase 6 plan registry as a payment system.
