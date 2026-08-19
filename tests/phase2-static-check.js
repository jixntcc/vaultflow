const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');

for (const file of ['server.js', 'public/js/core/store.js', 'public/js/core/api-client.js']) {
  assert.ok(fs.existsSync(path.join(root, file)), `Missing ${file}`);
}
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
assert.ok(html.includes('/js/core/store.js'));
assert.ok(html.includes('/js/core/api-client.js'));
assert.ok(html.includes('function handleSessionInvalid'));
assert.ok(!html.includes('refreshAuthToken()'));
assert.ok(!html.includes('vf_refresh_token'));
assert.ok(html.includes('mobile-txn-actions'));
assert.ok(html.includes('VaultFlowApi.request'));
assert.ok(html.includes("VaultFlowStore.setState"));
assert.ok(html.includes('standard desktop density'));
assert.ok(!html.includes("const options = {\n                method,\n                headers: {\n                    'Content-Type': 'application/json'\n                }\n            };"));
assert.ok(html.includes('function getTransactions()'));
assert.ok(html.includes('function setTransactions('));
assert.ok(!/\blet transactions\s*=/.test(html));
assert.ok(html.includes('function buildTransactionViewModel('));
assert.ok(html.includes('function renderTransactionActions('));
assert.ok(html.includes('data-transaction-action="edit"'));
assert.ok(html.includes('data-transaction-action="delete"'));
console.log('VaultFlow Phase 2C static assertions passed.');
