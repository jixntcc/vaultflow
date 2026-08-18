'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');

assert(html.includes("algorithm: 'counts-v1'"), 'Backup integrity manifest missing.');
assert(html.includes('verifyRestoredState('), 'Post-restore verification missing.');
assert(html.includes('assertFinanceConsistency()'), 'Finance consistency must be checked after restore.');
assert(html.includes('Automation rule definitions were not fully rehydrated.'), 'Automation rehydration verification missing.');
assert(html.includes("syncDerivedWallets({ reason: 'restore-complete' })"), 'Wallets must be re-derived after restore.');
assert(html.includes("syncDerivedWallets({ reason: 'restore-preload' })"), 'Wallet derivation should follow transaction restoration.');
assert(!html.includes("console.warn('Automation restore skipped:'"), 'Automation restore failures must not be silently swallowed.');
assert(html.includes("showToast('Backup restored and verified successfully.', 'success');"), 'Restore must only report success after verification.');
assert(html.includes('Backup integrity count mismatch'), 'Backup integrity counts must be validated.');

for (const field of ['transactions','vaults','goals','habits','habitLogs','automationRules']) {
    assert(html.includes(`${field}:`), `Integrity manifest missing ${field}.`);
}

console.log('Phase 8D Data Integrity & Recovery assertions passed.');
