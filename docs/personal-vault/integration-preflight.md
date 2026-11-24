# OS4.4 — Integration Preflight

## Purpose

Run a safe local preflight before attempting a real Personal Vault upload. This check verifies required local environment configuration, MongoDB connectivity and transaction support, and Cloudflare R2 connectivity.

## Run

```powershell
node .\tests\phase6-vault-integration-preflight.js
```

The script loads local environment variables through dotenv. It prints variable names only when required values are missing; it never prints configured values.

## Checks

1. All seven required environment variables are present.
2. MongoDB responds to a ping.
3. MongoDB accepts a read-only transaction probe against the `vaultusage` collection. The probe does not write or delete application data.
4. The configured R2 bucket responds to HeadBucket.

## Important scope

- A local PASS validates the local `.env` configuration, not Vercel's runtime environment.
- The user separately verifies the seven required variables exist in Vercel Production.
- This preflight does not create an upload, reserve quota, write a VaultFile, or modify R2 objects.
- It does not prove browser CORS, presigned browser PUT compatibility, CopyObject promotion, or the complete API workflow. Those are later OS4.4 tests.

## Safety

Never paste or commit `.env`, JWTs, R2 credentials, MongoDB connection strings, or presigned URLs. If the preflight fails, share only the sanitized error type, reason, HTTP status, and request ID.
