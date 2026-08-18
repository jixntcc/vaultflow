'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');

assert.strictEqual(pkg.engines?.node, '24.x', 'Node runtime must be pinned to the project Node 24 family.');
assert.strictEqual(pkg.scripts?.start, 'node server.js', 'Production start script must remain deterministic.');
assert.strictEqual(pkg.scripts?.dev, 'nodemon server.js', 'Development script must remain available.');
assert.strictEqual(pkg.scripts?.['release:check'], 'node tests/phase8a-release-environment-check.js', 'Release check script missing.');

assert(fs.existsSync(path.join(root, '.nvmrc')), '.nvmrc missing.');
assert.strictEqual(fs.readFileSync(path.join(root, '.nvmrc'), 'utf8').trim(), '24.18.0', '.nvmrc must pin Node 24.18.0.');

for (const file of ['.env.example', '.env.development.example', '.env.staging.example', '.env.production.example']) {
  assert(fs.existsSync(path.join(root, file)), `${file} missing.`);
}

assert(gitignore.split(/\r?\n/).includes('.env'), '.env must remain ignored.');
assert(gitignore.includes('.env.*'), '.env.* must remain ignored.');

assert(server.includes("const RELEASE_VERSION"), 'Release version metadata missing.');
assert(server.includes("app.get('/health/ready'"), 'Readiness endpoint missing.');
assert(server.includes("await connectToDatabase()"), 'Readiness endpoint must verify database connectivity.');
assert(server.includes("res.status(503)"), 'Readiness endpoint must return 503 when unavailable.');
assert(!server.includes('res.json({ MONGODB_URI'), 'Health endpoint must not expose database credentials.');
assert(!server.includes('JWT_SECRET: process.env.JWT_SECRET'), 'Health endpoint must not expose JWT secrets.');

assert(vercel.builds?.some(x => x.src === 'server.js'), 'Vercel server build missing.');
assert(vercel.routes?.some(x => x.src === '/(.*)' && x.dest === '/server.js'), 'Vercel catch-all route missing.');
assert(!vercel.crons, 'native Vercel cron must be removed for external scheduling.');
assert(server.includes('/api/cron/notifications'), 'notification endpoint missing for external scheduler.');
assert(server.includes('process.env.CRON_SECRET'), 'CRON_SECRET environment authentication missing.');

console.log('Phase 8A Release & Environment assertions passed.');
