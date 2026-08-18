'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

assert(server.includes("app.get('/health'"), 'Health endpoint missing.');
assert(server.includes("app.get('/health/ready'"), 'Readiness endpoint missing.');
assert(server.includes('await connectToDatabase();'), 'Readiness endpoint must call the actual database connector.');
assert(!server.includes('await connectDB();'), 'Undefined connectDB() call remains.');
assert(server.includes('const originalEnd = res.end'), 'Response end must be wrapped so Server-Timing is set before headers are committed.');
assert(server.includes("res.setHeader('Server-Timing', `app;dur=${durationMs.toFixed(1)}`)"), 'Server-Timing header must remain available.');
assert(server.includes("res.on('finish'"), 'Runtime telemetry finish listener missing.');
assert(server.includes('recordRouteMetric(routeKey, status, durationMs)'), 'Route metrics must remain recorded.');
assert(server.includes('console.warn(`[SLOW] ${routeKey} ${status} ${durationMs.toFixed(1)}ms`)'),
  'Slow request logging must remain available.');

console.log('Phase 9 production runtime regression assertions passed.');
