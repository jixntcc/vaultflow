# VaultFlow 3.x Stable Baseline

Phase 3A–3G is frozen as the baseline before the next major feature.

## Included domains
- Transactions
- Vaults
- Goals
- Wallets
- Habits
- Habit logs
- Habit analytics
- Web Push notifications
- Backup/restore integration

## Hardening
- Fixed the notification-status authentication/user-id contract.
- Bearer-token validation is explicit and JWT subject is required.
- Same-origin CORS is the default; cross-origin access is opt-in with `CORS_ORIGINS`.
- Added security response headers and a 100 KB JSON request limit.
- Added in-process throttling to register/login/reset-password endpoints.
- Removed authentication debug output and reset-token logging.
- Registration now matches the stronger password policy used by password reset.
- Transaction and Goal vault references must belong to the authenticated user.
- Server derives `vaultName` from the owned Vault rather than trusting client text.
- Added common transaction/goal indexes.
- Push subscription timezones are validated.
- Cron remains protected by `Authorization: Bearer <CRON_SECRET>`.

## Reliability contract
- Habit mutations are server-authoritative.
- Offline habit mutations are not falsely reported as saved.
- Duplicate completion/skip clicks are guarded in the UI.
- Habit occurrence uniqueness is enforced in MongoDB.
- Notification delivery uses an idempotency key.

## Production checklist
1. Set a strong `JWT_SECRET`.
2. Set `MONGODB_URI`.
3. Configure VAPID keys and `VAPID_SUBJECT`.
4. Configure `CRON_SECRET`.
5. Configure email credentials for password reset.
6. Add `CORS_ORIGINS` only when an external frontend needs API access.
7. Run `npm test`.
8. Test push on desktop and mobile.
9. Test backup/restore with a disposable account.
10. Verify the deployment plan supports the desired cron frequency.

## Known limitation
A per-minute reminder requires a scheduler that actually runs at that frequency. The application cannot manufacture minute-level background execution on a hosting plan that does not provide it.
