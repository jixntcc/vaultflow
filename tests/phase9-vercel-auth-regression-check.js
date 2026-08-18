'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));

assert(server.includes("app.post('/api/auth/login'"), 'Login endpoint missing.');
assert(server.includes('ensureConnection'), 'Login must retain database readiness protection.');
assert(server.includes('process.env.JWT_SECRET'), 'JWT secret must remain environment-based.');
assert(server.includes("req.get('Origin')"), 'CORS middleware must inspect the request origin.');
assert(server.includes('origin === `https://${host}`'), 'Same-origin HTTPS requests must be allowed.');
assert(server.includes('origin === `http://${host}`'), 'Same-origin HTTP requests must be allowed.');
assert(server.includes("configuredCorsOrigins.includes(origin)"), 'Explicit cross-origin allowlist must remain supported.');
assert(server.includes("CORS origin not allowed"), 'Unapproved cross-origin requests must remain rejected.');
assert(html.includes('src="/js/core/api-client.js"'), 'API client must be loaded.');
assert(html.includes("apiCall('/api/auth/login'"), 'Frontend login must call the production login endpoint.');
assert(!vercel.crons, 'Native Vercel cron must remain removed for external scheduling.');

console.log('Phase 9 Vercel authentication regression assertions passed.');
