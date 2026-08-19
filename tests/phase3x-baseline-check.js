const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const server = read('server.js'), html = read('public/index.html'), sw = read('public/sw.js');
const store = read('public/js/core/store.js'), domain = read('public/js/core/habit-domain.js');
const env = read('.env.example'), pkg = read('package.json');

const checks = [
  ['authentication middleware', /const authenticateToken\s*=/, server],
  ['auth middleware secret guard', /!process\.env\.JWT_SECRET/, server],
  ['notification status route is authenticated', /api\/notifications\/status', ensureConnection, authenticateToken/, server],
  ['notification status uses userId', /PushSubscription\.countDocuments\(\{ userId: req\.user\.userId \}\)/, server],
  ['cross-origin CORS is opt-in', /configuredCorsOrigins/, server],
  ['security headers', /X-Content-Type-Options/, server],
  ['JSON body limit', /express\.json\(\{ limit: '100kb' \}\)/, server],
  ['login throttling', /isAuthRateLimited/, server],
  ['no login debug logging', /^(?![\s\S]*LOGIN DEBUG)/, server],
  ['no reset-token logging', /^(?![\s\S]*\[MOCK EMAIL\].*reset link)/, server],
  ['owned vault helper', /function assertOwnedVault/, server],
  ['transaction vault ownership', /assertOwnedVault\(req\.user\.userId, vaultId/, server],
  ['goal vault ownership', /const ownedVault = await assertOwnedVault\(req\.user\.userId, vaultId/, server],
  ['timezone validation', /function isValidTimeZone/, server],
  ['push click handler', /notificationclick/, sw],
  ['push subscription change handler', /pushsubscriptionchange/, sw],
  ['habit page', /id="habits"/, html],
  ['habit store', /habits:\s*\{\s*items:/, store],
  ['habit domain', /HabitDomain/, html + domain],
  ['CORS env', /CORS_ORIGINS=/, env],
  ['test script', /(phase3x-baseline-check|run-all)\.js/, pkg]
];

const failures = [];
for (const [name, condition, source] of checks) {
  const ok = typeof condition === 'boolean' ? condition : condition.test(source);
  if (!ok) failures.push(name);
}
if (failures.length) {
  console.error('Phase 3.x baseline checks FAILED:');
  failures.forEach(x => console.error(' - ' + x));
  process.exit(1);
}
console.log('VaultFlow 3.x stable baseline assertions passed.');
