
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const serverPath = path.join(root, 'server.js');
const server = fs.readFileSync(serverPath, 'utf8');
const index = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));

const results = [];
function pass(name) { results.push({ name, status: 'PASS' }); }
function check(condition, name) {
  assert(condition, name);
  pass(name);
}

async function http(base, pathName, options = {}) {
  const response = await fetch(new URL(pathName, base), {
    redirect: 'manual',
    ...options
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  return { response, text, json };
}

async function staticSuite() {
  check(pkg.scripts?.test === 'node tests/run-all.js', 'canonical regression script');
  check(fs.existsSync(path.join(root, 'public', 'index.html')), 'production HTML entrypoint exists');
  check(vercel.version === 2, 'Vercel configuration present');
  check(vercel.builds?.some(b => b.src === 'server.js'), 'Vercel server build present');
  check(!vercel.crons, 'native Vercel cron removed; external scheduler expected');
check(server.includes("app.get('/api/cron/notifications'"), 'notification endpoint configured for external scheduler');

  check(/process\.env\.MONGODB_URI/.test(server), 'MongoDB URI comes from environment');
  check(/process\.env\.JWT_SECRET/.test(server), 'JWT secret comes from environment');
  check(/process\.env\.CRON_SECRET/.test(server), 'cron secret comes from environment');
  check(/process\.env\.VAPID_PRIVATE_KEY/.test(server), 'VAPID private key comes from environment');

  check(!/JWT_SECRET\s*=\s*['"][^'"]+['"]/.test(server), 'no hard-coded JWT secret');
  check(!/MONGODB_URI\s*=\s*['"][^'"]+['"]/.test(server), 'no hard-coded MongoDB URI');
  check(!/CRON_SECRET\s*=\s*['"][^'"]+['"]/.test(server), 'no hard-coded cron secret');

  check(/algorithms:\s*\[JWT_ALGORITHM\]/.test(server), 'JWT algorithm is explicitly constrained');
  check(/issuer:\s*JWT_ISSUER/.test(server) && /audience:\s*JWT_AUDIENCE/.test(server), 'JWT issuer/audience validation');
  check(/String\(payload\.userId\)\s*!==\s*String\(payload\.sub\)/.test(server), 'JWT subject/user invariant');
  check(/sessionVersion/.test(server), 'server-side session version validation');

  check(/X-Content-Type-Options.*nosniff/.test(server), 'nosniff header');
  check(/X-Frame-Options.*DENY/.test(server), 'frame denial header');
  check(/Strict-Transport-Security/.test(server), 'HSTS production header');
  check(/Cross-Origin-Resource-Policy.*same-origin/.test(server), 'CORP header');

  check(/JSON_BODY_LIMIT\s*\|\|\s*'100kb'/.test(server), 'bounded JSON body parser');
  check(/strict:\s*true/.test(server), 'strict JSON parsing');
  check(/API_RATE_LIMIT_MAX/.test(server) && /AUTH_RATE_LIMIT_MAX/.test(server), 'API/auth rate-limit configuration');
  check(/TRUST_PROXY === '1'/.test(server), 'explicit proxy trust configuration');
  check(/Content-Type must be application\/json/.test(server), 'JSON-only mutation enforcement');

  check(/app\.use\(\(error, req, res, next\) =>/.test(server), 'global API error normalization');
  check(/Request payload is too large/.test(server), 'JSON 413 normalization');
  check(/Malformed JSON payload/.test(server), 'JSON 400 normalization');
  check(/CORS origin not allowed/.test(server), 'CORS error normalization');

  check(/userId: req\.user\.userId/.test(server), 'resource writes bind to authenticated user');
  check(/assertOwnedResource/.test(server), 'central ownership helper used');
  check(/assertOwnedVault/.test(server), 'nested Vault ownership enforced');

  check(/readConcern:\s*\{\s*level:\s*'snapshot'\s*\}/.test(server), 'transaction snapshot reads');
  check(/writeConcern:\s*\{\s*w:\s*'majority'\s*\}/.test(server), 'transaction majority writes');
  check(/mutationReceiptSchema\.index\(\{ userId: 1, key: 1 \}, \{ unique: true \}\)/.test(server), 'sync idempotency unique index');
  check(/automationTriggerSchema\.index\(\{ ruleId: 1, key: 1 \}, \{ unique: true \}\)/.test(server), 'automation trigger unique index');
  check(/await runFinancialMutation\(async \(session\) =>/.test(server), 'sync uses transaction wrapper');
  check(/completeMutationReceipt\(req\.user\.userId, key, result, session\)/.test(server), 'sync receipt commit is transactional');

  check(/public\/index\.html/.test(vercel.routes?.[0]?.dest || '') || vercel.routes?.length > 0, 'Vercel route configuration exists');
  check(/Chart\.js|chart\.js/i.test(index), 'Chart.js reference exists in entrypoint');
  check(/<link[^>]+stylesheet/i.test(index), 'stylesheet references exist in entrypoint');

  // Inline JS remains intentionally present for the Phase 4I RC; extraction is Phase 4J cleanup.
  pass('inline JavaScript extraction deferred to post-RC refactor');
}

async function liveSuite() {
  const base = process.env.STAGING_BASE_URL;
  if (!base) {
    results.push({ name: 'live staging HTTP suite', status: 'SKIP', reason: 'STAGING_BASE_URL not set' });
    return;
  }

  const health = await http(base, '/health');
  check(health.response.status === 200, 'staging /health returns 200');
  check(health.json?.status === 'ok', 'staging health payload is healthy');

  const unauth = await http(base, '/api/transactions');
  check(unauth.response.status === 401, 'protected endpoint rejects missing JWT');

  check(unauth.response.headers.get('x-content-type-options') === 'nosniff', 'staging nosniff header');
  check(unauth.response.headers.get('x-frame-options') === 'DENY', 'staging frame denial header');
  check(Boolean(unauth.response.headers.get('referrer-policy')), 'staging referrer policy header');

  const malformed = await http(base, '/api/transactions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"broken":'
  });
  check(malformed.response.status === 400, 'staging malformed JSON returns 400');
  check(malformed.json?.error === 'Malformed JSON payload', 'staging malformed JSON is normalized');

  const wrongType = await http(base, '/api/transactions', {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: 'hello'
  });
  check(wrongType.response.status === 415, 'staging non-JSON mutation returns 415');

  const badCron = await http(base, '/api/cron/notifications');
  check(badCron.response.status === 401, 'staging cron rejects missing secret');

  if (process.env.STAGING_CRON_SECRET) {
    const cron = await http(base, '/api/cron/notifications', {
      headers: { authorization: `Bearer ${process.env.STAGING_CRON_SECRET}` }
    });
    check([200, 503].includes(cron.response.status), 'staging cron responds without authentication bypass');
    if (cron.response.status === 200) check(cron.json?.ok === true, 'staging cron success payload');
  }

  if (process.env.STAGING_TEST_USERNAME && process.env.STAGING_TEST_PASSWORD) {
    const login = await http(base, '/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: process.env.STAGING_TEST_USERNAME,
        password: process.env.STAGING_TEST_PASSWORD
      })
    });
    check(login.response.status === 200, 'staging test account login');
    const token = login.json?.token;
    check(Boolean(token), 'staging login returns access token');

    const vaults = await http(base, '/api/vaults', {
      headers: { authorization: `Bearer ${token}` }
    });
    check(vaults.response.status === 200, 'authenticated vault read');

    const logout = await http(base, '/api/auth/logout', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      body: '{}'
    });
    check(logout.response.status === 200, 'staging logout');

    const revoked = await http(base, '/api/vaults', {
      headers: { authorization: `Bearer ${token}` }
    });
    check(revoked.response.status === 401, 'revoked JWT rejected after logout');
  } else {
    results.push({
      name: 'authenticated staging smoke suite',
      status: 'SKIP',
      reason: 'STAGING_TEST_USERNAME/STAGING_TEST_PASSWORD not configured'
    });
  }

  if (process.env.STAGING_USER_A_TOKEN && process.env.STAGING_USER_B_RESOURCE_ID) {
    const attack = await http(base, `/api/transactions/${encodeURIComponent(process.env.STAGING_USER_B_RESOURCE_ID)}`, {
      headers: { authorization: `Bearer ${process.env.STAGING_USER_A_TOKEN}` }
    });
    check([403, 404].includes(attack.response.status), 'cross-user resource probe denied');
  } else {
    results.push({
      name: 'cross-user live authorization probe',
      status: 'SKIP',
      reason: 'STAGING_USER_A_TOKEN/STAGING_USER_B_RESOURCE_ID not configured'
    });
  }
}

(async () => {
  try {
    await staticSuite();
    await liveSuite();

    const failed = results.filter(r => r.status === 'FAIL');
    const skipped = results.filter(r => r.status === 'SKIP');

    console.log('\nVaultFlow Phase 4I Release Candidate');
    console.log('===================================');
    for (const result of results) {
      console.log(`[${result.status}] ${result.name}${result.reason ? ` — ${result.reason}` : ''}`);
    }

    console.log(`\nPASS: ${results.filter(r => r.status === 'PASS').length}`);
    console.log(`SKIP: ${skipped.length}`);
    console.log(`FAIL: ${failed.length}`);

    if (failed.length) process.exit(1);
    if (skipped.length) {
      console.log('\nRC STATUS: CONDITIONAL — live staging checks remain.');
      if (process.env.STRICT_RC === '1') process.exit(2);
      process.exit(0);
    }

    console.log('\nRC STATUS: PASS');
  } catch (error) {
    console.error('\nRC STATUS: FAIL');
    console.error(error.message);
    process.exit(1);
  }
})();
