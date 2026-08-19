const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');

assert.ok(html.includes('function getWallets()'));
assert.ok(html.includes('function setWallets('));
assert.ok(html.includes('function deriveWalletBalances('));
assert.ok(html.includes('function syncDerivedWallets('));
assert.ok(html.includes('function assertFinanceConsistency('));
assert.ok(html.includes('finance: { ...state.finance, wallets: normalized }'));
assert.ok(!html.includes('let wallets = {'));
assert.ok(!html.includes('function calculateWalletBalances() {\n            if (isDemoMode)'));
assert.ok(html.includes("return syncDerivedWallets({ reason: 'calculateWalletBalances' });"));
assert.ok(html.includes('getWallets().HR'));
assert.ok(html.includes('getWallets().HL'));
console.log('VaultFlow Phase 2F static assertions passed.');
