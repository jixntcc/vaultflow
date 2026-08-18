
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const env = fs.readFileSync(path.join(root, '.env.example'), 'utf8');

function must(pattern, label) {
  assert(pattern.test(server), `Missing API hardening: ${label}`);
}

must(/express\.json\(\{[\s\S]*limit:\s*process\.env\.JSON_BODY_LIMIT \|\| '100kb'[\s\S]*strict:\s*true/s, 'bounded strict JSON parser');
must(/MAX_ARRAY_ITEMS/, 'array item limit');
must(/MAX_STRING_LENGTH/, 'string length limit');
must(/Request payload is too complex/, 'complexity rejection');
must(/__proto__.*prototype.*constructor/s, 'prototype-pollution field rejection');
must(/Content-Type must be application\/json/, 'JSON mutation content type');
must(/X-Content-Type-Options.*nosniff/, 'nosniff');
must(/X-Frame-Options.*DENY/, 'frame protection');
must(/Strict-Transport-Security/, 'production HSTS');
must(/Cross-Origin-Resource-Policy.*same-origin/, 'cross-origin resource policy');

must(/function consumeRateLimit\(key, max, windowMs\)/, 'rate limiter core');
must(/API_RATE_LIMIT_MAX/, 'API limit config');
must(/AUTH_RATE_LIMIT_MAX/, 'auth limit config');
must(/X-RateLimit-Limit/, 'rate limit headers');
must(/Retry-After/, 'retry-after');
must(/app\.use\('\/api', apiRateLimit\)/, 'global API limiter');

must(/password\.length > 128/, 'password max length');
must(/username\.length > 64 \|\| email\.length > 254/, 'registration field limits');
must(/username\.length > 254 \|\| password\.length > 128/, 'login field limits');

must(/entity\.too\.large/, '413 normalization');
must(/Malformed JSON payload/, 'JSON parse normalization');

for (const key of [
  'JSON_BODY_LIMIT=',
  'API_RATE_LIMIT_MAX=',
  'API_RATE_LIMIT_WINDOW_MS=',
  'AUTH_RATE_LIMIT_MAX=',
  'AUTH_RATE_LIMIT_WINDOW_MS=',
  'MAX_ARRAY_ITEMS=',
  'MAX_STRING_LENGTH=',
  'TRUST_PROXY='
]) assert(env.includes(key), `Missing ${key} in .env.example`);

console.log('Phase 4H-3 API/input hardening assertions passed.');
