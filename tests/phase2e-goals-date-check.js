const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');

assert.ok(html.includes('function getGoals()'));
assert.ok(html.includes('function setGoals('));
assert.ok(html.includes('planning: { ...state.planning, goals: normalized }'));
assert.ok(html.includes("return setGoals(await apiCall('/api/goals')"));
assert.ok(!html.includes('let goals = [];'));
assert.ok(html.includes('getGoals().find(g => g._id === id)'));
assert.ok(html.includes('getGoals().length === 0'));
assert.ok(html.includes('getGoals().forEach(goal =>'));
assert.ok(html.includes('goals: getGoals().map('));

const modalStart = html.indexOf('function showTransactionModal');
const modalEnd = html.indexOf('function showVaultModal', modalStart);
assert.ok(modalStart >= 0 && modalEnd > modalStart);
const modal = html.slice(modalStart, modalEnd);

const editMarker = "if (id)";
const elseMarker = "} else {";
const elseIndex = modal.indexOf(elseMarker);
assert.ok(elseIndex > modal.indexOf(editMarker));
const editSection = modal.slice(0, elseIndex);
const addSection = modal.slice(elseIndex);

assert.ok(editSection.includes("document.getElementById('txnDate').value = txn.date.split('T')[0];"));
assert.ok(editSection.includes("document.getElementById('txnTime').value = txn.time;"));
assert.ok(!editSection.includes('setDefaultDateTime();'));
assert.ok(addSection.includes("setDefaultDateTime();"));

assert.ok(html.includes("const year = now.getFullYear();"));
assert.ok(html.includes("const month = String(now.getMonth() + 1).padStart(2, '0');"));
assert.ok(html.includes("document.getElementById('txnDate').value = `${year}-${month}-${day}`;"));

console.log('VaultFlow Phase 2E static assertions passed.');
