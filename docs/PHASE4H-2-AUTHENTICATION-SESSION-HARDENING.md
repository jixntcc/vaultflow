# Phase 4H-2 — Authentication & Session Hardening

## Status: PASS

This phase hardens VaultFlow's JWT authentication without changing the existing frontend bearer-token contract.

## Changes

### 1. Centralized JWT issuance

`issueAccessToken(user)` is now the single token creation path for registration and login.

Tokens contain:
- `sub`
- `userId`
- `username`
- `sessionVersion`
- `jti`

The signing configuration is explicit:
- algorithm: HS256
- issuer: `JWT_ISSUER`
- audience: `JWT_AUDIENCE`
- expiration: `AUTH_TOKEN_TTL`

### 2. Live session validation

`authenticateToken` now performs two checks:

1. Cryptographic JWT verification.
2. A live User lookup and `sessionVersion` comparison.

The resulting flow is:

JWT -> verify signature/issuer/audience/expiry -> load User -> compare sessionVersion -> req.user

This means a valid JWT is no longer sufficient by itself.

### 3. Session revocation

Added:

`POST /api/auth/logout`

The endpoint increments the user's `sessionVersion`, immediately invalidating the current token and all tokens issued under that session version.

### 4. Password-reset invalidation

Successful password reset increments `sessionVersion`.

Therefore tokens issued before a password reset are invalidated automatically.

### 5. Legacy-token migration

Tokens that do not contain `sessionVersion` are rejected.

This intentionally logs out tokens issued before the Phase 4H-2 deployment. Users simply authenticate again.

### 6. Trusted password-reset origin

Password-reset links now prefer `PUBLIC_APP_URL` instead of blindly trusting the request Host header.

### 7. Client logout integration

The existing local logout behavior remains immediate, but the client now makes a best-effort authenticated request to `/api/auth/logout` so the server revokes the session as well.

### 8. Environment contract

`.env.example` documents:
- `AUTH_TOKEN_TTL`
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `PUBLIC_APP_URL`

## Verification

- `server.js` syntax: PASS
- Phase 4H-2 auth/session assertions: PASS
- Phase 4H-1B authorization matrix: PASS
- Full regression suite: PASS

## Remaining staging validation

A live staging test is still required because this environment does not provide a MongoDB runtime.

The staging test should verify:

1. Login creates a valid session.
2. Authenticated request succeeds.
3. Logout invalidates the token.
4. Password reset invalidates pre-reset tokens.
5. A second login creates a new valid session.
6. Expired tokens are rejected.
7. Wrong issuer/audience is rejected.
8. Tokens signed with an unsupported algorithm are rejected.
9. Deleting the user invalidates the token.
10. Concurrent requests around logout behave as expected.

## Deployment note

Deploying Phase 4H-2 will intentionally invalidate pre-hardening JWTs because old tokens lack `sessionVersion`. This is a security migration, not a regression.
