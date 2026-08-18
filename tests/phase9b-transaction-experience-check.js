'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'css', 'app.css'), 'utf8');

assert(html.includes('id="searchTransactions"'), 'Transaction search missing.');
assert(html.includes('id="filterDateFrom"'), 'Transaction from-date filter missing.');
assert(html.includes('id="filterDateTo"'), 'Transaction to-date filter missing.');
assert(html.includes('id="sortTransactions"'), 'Transaction sort control missing.');
assert(html.includes('id="transactionResultsSummary"'), 'Transaction results summary missing.');
assert(html.includes('clearTransactionFilters()'), 'Clear-filter action missing.');
assert(html.includes('function filterTransactions()'), 'Transaction filter function missing.');
assert(html.includes('t.category, t.location, t.notes, t.wallet, t.vaultName'), 'Search scope not expanded.');
assert(html.includes("sort === 'highest'"), 'Amount sorting missing.');
assert(html.includes("sort === 'oldest'"), 'Date sorting missing.');

assert(html.includes('function showTransactionModal(id = null)'), 'Transaction modal missing.');
assert(html.includes('populateVaultSelect();'), 'Vaults must populate before edit values are assigned.');
assert(html.includes('const txn = getTransactions().find'), 'Edit must use current domain transaction source.');
assert(html.includes('Do not call setDefaultDateTime() for an existing transaction.'), 'Edit date/time invariant documentation missing.');
assert(html.includes("const dateOnly = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate.slice(0, 10);"), 'Stored transaction date must be preserved.');
assert(html.includes("document.getElementById('txnTime').value = String(txn.time || '00:00').slice(0, 5);"), 'Stored transaction time must be preserved.');
assert(html.includes('data-transaction-action="edit"'), 'Shared edit action contract missing.');
assert(html.includes('data-transaction-action="delete"'), 'Shared delete action contract missing.');

assert(css.includes('Phase 9B — Transaction Experience'), 'Phase 9B CSS missing.');
assert(css.includes('min-height: 44px'), 'Mobile transaction actions need touch-friendly targets.');
assert(css.includes('@media (max-width: 480px)'), 'Small mobile transaction layout missing.');

assert(!html.match(/\bon(?:click|change|input|submit|keydown|keyup)\s*=/i), 'Inline event handlers returned.');
console.log('Phase 9B Transaction Experience assertions passed.');
