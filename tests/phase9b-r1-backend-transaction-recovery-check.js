'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

function blockBetween(startMarker, endMarker) {
  const start = server.indexOf(startMarker);
  const end = server.indexOf(endMarker, start);
  assert(start >= 0 && end > start, `Could not locate block ${startMarker}`);
  return server.slice(start, end);
}

const create = blockBetween("app.post('/api/transactions'", "// Update transaction");
const update = blockBetween("app.put('/api/transactions/:id'", "// Delete transaction");
const del = blockBetween("app.delete('/api/transactions/:id'", "// ============================================\n// GOAL ROUTES");

assert(create.includes("authenticateToken"), 'Create transaction must remain authenticated.');
assert(create.includes("userId: req.user.userId"), 'Created transaction must be owned by authenticated user.');
assert(create.includes("assertOwnedVault(req.user.userId"), 'Create must enforce owned-vault authorization.');
assert(create.includes("await created.save()"), 'Create must persist without the hanging MongoDB session transaction wrapper.');
assert(!create.includes("runFinancialMutation"), 'Create must not use the Vercel-hanging session transaction wrapper.');
assert(create.includes("rebuildVaultBalances(req.user.userId)"), 'Create must rebuild balances from authoritative transaction data.');
assert(create.includes("balancesRebuilt"), 'Create must expose balance rebuild status.');

assert(update.includes("authenticateToken"), 'Update transaction must remain authenticated.');
assert(update.includes("userId: req.user.userId"), 'Update filter must include authenticated user ownership.');
assert(update.includes("assertOwnedVault(req.user.userId"), 'Update must enforce owned-vault authorization.');
assert(update.includes("maxTimeMS: 10000"), 'Update database write must be bounded.');
assert(!update.includes("runFinancialMutation"), 'Update must not use the Vercel-hanging session transaction wrapper.');

assert(del.includes("authenticateToken"), 'Delete transaction must remain authenticated.');
assert(del.includes("userId: req.user.userId"), 'Delete filter must include authenticated user ownership.');
assert(del.includes("findOneAndDelete"), 'Delete must atomically target one owned transaction.');
assert(del.includes("maxTimeMS: 10000"), 'Delete database operation must be bounded.');
assert(!del.includes("runFinancialMutation"), 'Delete must not use the Vercel-hanging session transaction wrapper.');

const rebuild = blockBetween("async function rebuildVaultBalances", "async function runFinancialMutation");
assert(rebuild.includes(".maxTimeMS(10000)"), 'Balance source queries must be bounded.');
assert(rebuild.includes("Promise.all(vaults.map"), 'Balance updates must run concurrently rather than sequentially per vault.');
assert(rebuild.includes("Vault.updateOne(") && rebuild.includes("{ _id: vault._id, userId }"), 'Each balance write must remain explicitly user-scoped.');

assert(server.includes("function runFinancialMutation"), 'Shared financial mutation helper must remain for other domains.');
assert(server.includes("session.withTransaction"), 'Other transactional domains must retain their existing transaction mechanism.');

console.log('Phase 9B-R1 backend transaction recovery assertions passed.');
