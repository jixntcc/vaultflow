const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');

assert.ok(html.includes('function getVaults()'));
assert.ok(html.includes('function setVaults('));
assert.ok(html.includes('finance: { ...state.finance, vaults: normalized }'));
assert.ok(html.includes("return setVaults(await apiCall('/api/vaults')"));
assert.ok(!html.includes('let vaults = []'));
assert.ok(!html.includes("vaults = await apiCall('/api/vaults')"));
assert.ok(html.includes('getVaults().find(v => v._id === vaultIdValue)'));
assert.ok(html.includes('getVaults().find(v => v._id === vaultId)'));
assert.ok(html.includes('[...getVaults()]'));
console.log('VaultFlow Phase 2D static assertions passed.');
