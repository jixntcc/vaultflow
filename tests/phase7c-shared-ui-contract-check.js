
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');

const inlineEvents = html.match(/\bon(?:click|change|input|submit|keydown|keyup|focus|blur)\s*=/gi) || [];
assert.strictEqual(inlineEvents.length, 0, `Inline event attributes remain: ${inlineEvents.length}`);

const javascriptUrls = html.match(/(?:href|src)\s*=\s*["']javascript:/gi) || [];
assert.strictEqual(javascriptUrls.length, 0, `javascript: URLs remain: ${javascriptUrls.length}`);

const vfActions = [...new Set([...html.matchAll(/data-vf-action="([^"]+)"/g)].map(m => m[1]))];
const dispatcher = html.match(/document\.addEventListener\('click', async function\(e\) \{\s*const actionButton = e\.target\.closest\('\[data-vf-action\]'\)/);
assert(dispatcher, 'Generic data-vf-action delegated dispatcher is missing.');

const expected = [
  'switch-page','show-transaction-modal','show-vault-modal','show-goal-modal',
  'open-habit-modal','open-habit-history','refresh-intelligence','close-modal',
  'close-transaction-modal','close-plan-modal','close-forgot-password-modal',
  'close-command-palette','cancel-restore-backup','confirm-restore-backup',
  'onboarding-next','onboarding-prev','onboarding-save-wallet',
  'onboarding-save-income','onboarding-save-expense','onboarding-skip-goal',
  'onboarding-save-goal','onboarding-finish','toggle-phase4-rule',
  'delete-phase4-rule','command-result'
];
for (const action of expected) assert(vfActions.includes(action), `Missing shared action: ${action}`);

for (const m of html.matchAll(/data-vf-action="switch-page"([^>]*)/g)) {
  assert(m[1].includes('data-vf-page='), `switch-page action missing data-vf-page: ${m[0]}`);
}
for (const m of html.matchAll(/data-vf-action="close-modal"([^>]*)/g)) {
  assert(m[1].includes('data-vf-modal='), `close-modal action missing data-vf-modal: ${m[0]}`);
}
for (const m of html.matchAll(/data-vf-action="(toggle-phase4-rule|delete-phase4-rule)"([^>]*)/g)) {
  assert(m[2].includes('data-vf-rule-id='), `Phase4 rule action missing rule id: ${m[0]}`);
}

console.log('Phase 7C shared UI contract enforcement passed.');
