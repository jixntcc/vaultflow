# Phase 8A — Release & Environment

## Status: IMPLEMENTED

Phase 8A establishes a predictable runtime/release boundary without changing domain models.

### Runtime

VaultFlow is now pinned to the Node 24 runtime family:

- `package.json` → `engines.node = 24.x`
- `.nvmrc` → `24.18.0`

This matches the current development environment and prevents silent major-runtime drift.

### Environment profiles

Templates are provided for:

- `.env.development.example`
- `.env.staging.example`
- `.env.production.example`

Secrets are never populated in these files.

The existing `.gitignore` continues to ignore `.env`, `.env.*`, and `*.env`.

### Release metadata

The server supports:

- `RELEASE_VERSION`
- `RELEASE_COMMIT`

If not supplied, version falls back to `package.json` and commit to `local`.

### Health endpoints

`GET /health`

Liveness endpoint. Returns non-sensitive release metadata.

`GET /health/ready`

Readiness endpoint. Attempts the existing MongoDB connection and returns:

- `200` when the database is connected
- `503` when database readiness fails

No credentials or secrets are returned.

### Vercel

Existing deployment contract is preserved:

- `server.js` uses `@vercel/node`
- catch-all route remains
- notification cron remains

### Release validation

`npm run release:check`

checks:
- Node runtime pin
- startup script
- environment templates
- secret ignore rules
- health/readiness implementation
- Vercel routes/cron
- release metadata

### Deployment flow

```text
Local development
    ↓
npm run release:check
    ↓
npm test
    ↓
Deploy staging
    ↓
GET /health
GET /health/ready
    ↓
Run staging HTTP suite
    ↓
Release candidate
    ↓
Production
```

Phase 8A does not add CI/CD automation yet; that belongs to the next release-engineering step.

### Important

Populate actual secrets only in the deployment platform/environment manager. Never copy real `.env` files into source control or the release ZIP.
