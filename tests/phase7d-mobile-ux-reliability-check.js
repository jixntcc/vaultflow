
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'css', 'app.css'), 'utf8');

const head = html.slice(0, html.toLowerCase().indexOf('</head>'));
const viewportMatches = head.match(/<meta\s+name=["']viewport["'][^>]*>/gi) || [];
assert.strictEqual(viewportMatches.length, 1, `Expected one viewport meta tag in document head, found ${viewportMatches.length}.`);
assert(/width=device-width/i.test(viewportMatches[0]), 'Viewport must use device width.');

const inlineEvents = html.match(/\bon(?:click|change|input|submit|keydown|keyup|focus|blur)\s*=/gi) || [];
assert.strictEqual(inlineEvents.length, 0, `Inline event attributes returned: ${inlineEvents.length}.`);

assert(css.includes('@media (max-width: 768px)'), 'Mobile breakpoint missing.');
assert(css.includes('min-height: 44px'), '44px mobile touch baseline missing.');
assert(css.includes('font-size: 16px'), 'Mobile input font-size baseline missing.');
assert(css.includes('max-height: calc(100dvh - 24px)'), 'Mobile modal viewport constraint missing.');
assert(css.includes('env(safe-area-inset-bottom)'), 'Safe-area handling missing.');
assert(css.includes('prefers-reduced-motion: reduce'), 'Reduced-motion support missing.');
assert(css.includes('overflow-x: hidden'), 'Global horizontal overflow guard missing.');

for (const contract of [
  ['Vault', 'renderVaultActions', 'data-vault-action'],
  ['Goals', 'renderGoalActions', 'data-goal-action'],
  ['Habits', 'renderHabitActions', 'data-habit-action-type'],
  ['Reports', 'renderReportActions', 'data-report-action'],
  ['Intelligence', 'renderIntelligenceActions', 'data-intelligence-action'],
  ['Settings', 'renderSettingsActions', 'data-settings-action']
]) {
  assert(html.includes(`function ${contract[1]}`), `${contract[0]} action renderer missing.`);
  assert(html.includes(contract[2]), `${contract[0]} action contract missing.`);
}

assert(html.includes('function renderTransactionActions'), 'Transaction action renderer missing.');
assert(html.includes('data-transaction-action="edit"'), 'Transaction edit action missing.');
assert(html.includes('data-transaction-action="delete"'), 'Transaction delete action missing.');
assert(html.includes('if (window.innerWidth <= 768)'), 'Transaction mobile renderer missing.');

const mobileActions = [
  'data-vault-action="edit"',
  'data-vault-action="delete"',
  'data-goal-action="edit"',
  'data-goal-action="delete"',
  'data-transaction-action="edit"',
  'data-transaction-action="delete"'
];
for (const action of mobileActions) assert(html.includes(action), `Mobile-critical action missing: ${action}`);

assert(!html.includes('onclick="${item.action}"'), 'Executable dynamic action interpolation returned.');

console.log('Phase 7D Mobile UX reliability/static visual QA passed.');
