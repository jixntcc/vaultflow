
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const env = fs.readFileSync(path.join(root, '.env.example'), 'utf8');

function must(pattern, label) {
  assert(pattern.test(server), `Missing authentication hardening: ${label}`);
}

function mustHtml(pattern, label) {
  assert(pattern.test(html), `Missing client session integration: ${label}`);
}

// Session state exists on the User record.
must(/sessionVersion:\s*\{\s*type:\s*Number,\s*default:\s*0/, 'User.sessionVersion');

// Token issuance is centralized and includes strong identity/session claims.
must(/function issueAccessToken\(user\)/, 'central token issuer');
must(/sub:\s*userId/, 'JWT subject');
must(/userId,\s*username:\s*user\.username,\s*sessionVersion/, 'JWT identity/session claims');
must(/algorithm:\s*JWT_ALGORITHM/, 'explicit signing algorithm');
must(/issuer:\s*JWT_ISSUER/, 'JWT issuer');
must(/audience:\s*JWT_AUDIENCE/, 'JWT audience');
must(/jwtid:\s*crypto\.randomUUID\(\)/, 'unique JWT id');

// Verification is explicit and followed by a live account/session-version check.
must(/jwt\.verify\(token,\s*process\.env\.JWT_SECRET,\s*\{[\s\S]*algorithms:\s*\[JWT_ALGORITHM\],[\s\S]*issuer:\s*JWT_ISSUER,[\s\S]*audience:\s*JWT_AUDIENCE/s, 'strict JWT verification');
must(/User\.findById\(payload\.userId\)[\s\S]*?sessionVersion/s, 'live user lookup');
must(/tokenVersion !== currentVersion/, 'session revocation check');
must(/Session revoked\. Please login again\./, 'revoked-session response');

// Old tokens without the new session claim are intentionally rejected.
must(/!Number\.isInteger\(tokenVersion\)/, 'legacy token rejection');

// Login and registration use the same token issuer.
assert.strictEqual((server.match(/const token = issueAccessToken\(user\);/g) || []).length, 2, 'register/login must use centralized issuer');

// Logout revokes the current session version.
must(/\/api\/auth\/logout[\s\S]*authenticateToken/, 'authenticated logout endpoint');
must(/sessionVersion:\s*req\.user\.sessionVersion[\s\S]*\$inc:\s*\{\s*sessionVersion:\s*1\s*\}/s, 'logout session increment');

// Password reset revokes all existing sessions.
must(/user\.sessionVersion\s*=\s*Number\(user\.sessionVersion\s*\|\|\s*0\)\s*\+\s*1/, 'password reset session invalidation');

// Password reset links use a trusted configured public origin when supplied.
must(/PUBLIC_APP_URL/, 'configured public app URL');
must(/const resetOrigin = PUBLIC_APP_URL \|\|/, 'trusted reset origin');

// Client logout invokes server revocation while preserving immediate local logout.
mustHtml(/fetch\('\/api\/auth\/logout'/, 'server logout request');
mustHtml(/localStorage\.removeItem\('vf_token'\)/, 'local token cleanup');

// Environment contract is documented.
for (const key of ['JWT_ISSUER=', 'JWT_AUDIENCE=', 'PUBLIC_APP_URL=', 'AUTH_TOKEN_TTL=']) {
  assert(env.includes(key), `Missing ${key} in .env.example`);
}

console.log('Phase 4H-2 authentication/session hardening assertions passed.');
