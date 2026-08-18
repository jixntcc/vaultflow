# Phase 4H-3 — API/Input Hardening & Rate-Limit Infrastructure

## Status: PASS

### Request parser hardening
- JSON request bodies are bounded by `JSON_BODY_LIMIT` (default `100kb`).
- Strict JSON parsing is enabled.
- API mutation requests must use JSON.
- Oversized payloads return JSON `413`.
- Malformed JSON returns JSON `400`.
- Nested request complexity is bounded to 2,000 traversed nodes.
- Arrays are capped by `MAX_ARRAY_ITEMS` (default 500).
- Strings are capped by `MAX_STRING_LENGTH` (default 2,000).
- Objects are capped at 100 fields per object.
- Prototype-pollution keys (`__proto__`, `prototype`, `constructor`) are rejected.

### Security headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`
- `X-DNS-Prefetch-Control: off`
- `Cross-Origin-Resource-Policy: same-origin`
- HSTS in production HTTPS requests

### Rate limiting
A bounded per-process limiter protects `/api` traffic.

Default:
- 180 requests/minute
- rate-limit headers are returned
- 429 responses include `Retry-After`

Authentication-sensitive endpoints retain stricter endpoint-specific limits.

The limiter's key store is bounded to prevent unbounded memory growth and expired entries are cleaned up.

### Proxy/IP handling
`TRUST_PROXY=1` must be explicitly enabled before Express trusts the first proxy hop. This reduces client-controlled IP spoofing when the app is not intentionally behind a proxy.

### Authentication input limits
- Username <= 64 characters during registration
- Email <= 254 characters
- Password <= 128 characters

### Production architecture note
The limiter is dependency-free and works in a single process. It is **not a distributed global limiter**. Vercel/serverless or multi-instance production can execute requests on different instances.

Before high-scale production traffic, the same `consumeRateLimit()` contract should be backed by shared Redis/Upstash-style storage. The local limiter remains useful as a per-instance abuse shield and development fallback.

### Regression
The existing Phase 3.x baseline test was updated to recognize the intentional configurable JSON-body-limit contract rather than requiring a hard-coded literal.

Verification:
- Node syntax checks: PASS
- Phase 4H-3 assertions: PASS
- Full VaultFlow regression suite: PASS

### Required staging validation
Run real HTTP tests against staging for:
- rate-limit threshold
- repeated login attempts
- oversized JSON
- malformed JSON
- deep/complex payloads
- oversized arrays/strings
- non-JSON mutation requests
- spoofed proxy headers
- disallowed CORS origins
- multiple application instances sharing the rate-limit store
