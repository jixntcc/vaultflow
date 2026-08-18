'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

assert(pkg.scripts?.['test:observability'], 'Observability test script missing.');
assert(server.includes('const runtimeMetrics ='), 'Runtime metrics store missing.');
assert(server.includes("app.get('/health/metrics'"), 'Metrics endpoint missing.');
assert(server.includes("OBSERVABILITY_ENABLED !== '1'"), 'Metrics endpoint must be opt-in.');
assert(server.includes("Server-Timing"), 'Server-Timing response header missing.');
assert(server.includes('SLOW_REQUEST_MS'), 'Slow request threshold missing.');
assert(server.includes('recordRouteMetric'), 'Route-level metrics missing.');
assert(server.includes('recentErrors'), 'Recent error diagnostics missing.');
assert(server.includes('request bodies, auth tokens, or PII'), 'Telemetry privacy boundary missing.');

for (const secret of ['JWT_SECRET','MONGODB_URI','EMAIL_PASS','VAPID_PRIVATE_KEY']) {
  const metricsBlock = server.slice(server.indexOf("app.get('/health/metrics'"), server.indexOf("// ============================================\n// START SERVER"));
  assert(!metricsBlock.includes(secret), `Metrics endpoint must not expose ${secret}.`);
}

assert(html.includes('function getClientPerformanceSnapshot()'), 'Client performance snapshot missing.');
assert(html.includes('performance.getEntriesByType'), 'Browser Performance API integration missing.');
assert(html.includes('devicePixelRatio'), 'Viewport performance context missing.');

for (const envFile of ['.env.development.example','.env.staging.example','.env.production.example']) {
  const env = fs.readFileSync(path.join(root, envFile), 'utf8');
  assert(env.includes('OBSERVABILITY_ENABLED='), `${envFile} missing observability configuration.`);
  assert(env.includes('SLOW_REQUEST_MS='), `${envFile} missing slow-request threshold.`);
}

console.log('Phase 8E Observability & Performance assertions passed.');
