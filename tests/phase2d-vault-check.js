
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const store = fs.readFileSync(path.join(root, 'public/js/core/store.js'), 'utf8');

assert.ok(html.includes('function getVaults()'));
assert.ok(html.includes('function setVaults('));
assert.ok(html.includes('return VaultFlowStore.getVaults()'));
assert.ok(html.includes('return VaultFlowStore.setVaults(nextVaults, meta)'));
assert.ok(store.includes('function getVaults()'));
assert.ok(store.includes('function setVaults('));
assert.ok(store.includes('function upsertVault('));
assert.ok(store.includes('function removeVault('));
assert.ok(html.includes("return setVaults(await apiCall('/api/vaults')"));
assert.ok(!html.includes('let vaults = []'));
assert.ok(!html.includes("vaults = await apiCall('/api/vaults')"));
assert.ok(html.includes('getVaults().find(v => v._id === vaultIdValue)'));
assert.ok(html.includes('getVaults().find(v => v._id === vaultId)'));
console.log('VaultFlow Phase 2D Store migration assertions passed.');
