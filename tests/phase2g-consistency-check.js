const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

assert.ok(server.includes('async function rebuildVaultBalances('));
assert.ok(server.includes('async function runFinancialMutation('));
assert.ok(server.includes('mongoose.startSession()'));
assert.ok(server.includes('session.withTransaction('));
assert.ok(server.includes('await rebuildVaultBalances(req.user.userId, session)'));

for (const route of [
  "app.post('/api/transactions'",
  "app.put('/api/transactions/:id'",
  "app.delete('/api/transactions/:id'",
  "app.put('/api/vaults/:id'",
  "app.delete('/api/vaults/:id'"
]) assert.ok(server.includes(route), `Missing ${route}`);

assert.ok(server.includes("error.statusCode = 409"));
assert.ok(server.includes('Transaction.countDocuments'));
assert.ok(server.includes('Goal.countDocuments'));
assert.ok(server.includes('Number.isFinite(normalizedAmount)') || server.includes('normalizeAmount(amount)'));
console.log('VaultFlow Phase 2G static consistency assertions passed.');
