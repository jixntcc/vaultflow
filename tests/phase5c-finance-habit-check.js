
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const service = fs.readFileSync(path.join(root, 'services', 'phase4-intelligence.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'css', 'app.css'), 'utf8');

assert(service.includes('function calculateFinanceHabitCorrelation'), 'finance-habit correlation engine missing');
assert(service.includes('spendingDifferencePercent'), 'spending comparison metric missing');
assert(service.includes('correlation'), 'correlation metric missing');
assert(server.includes('calculateFinanceHabitCorrelation'), 'server does not invoke finance-habit engine');
assert(server.includes('financeHabit'), 'API response does not expose financeHabit read-model');
assert(html.includes('id="financeHabitConnection"'), 'intelligence finance-habit surface missing');
assert(html.includes('id="dashboardFinanceHabitConnection"'), 'dashboard finance-habit surface missing');
assert(html.includes('function renderFinanceHabitConnection'), 'finance-habit renderer missing');
assert(/correlation does not prove causation/i.test(html), 'causation disclaimer missing');
assert(css.includes('.finance-habit-connection'), 'finance-habit styles missing');
assert(css.includes('.finance-habit-mini'), 'dashboard finance-habit styles missing');

console.log('Phase 5C Finance + Habit System assertions passed.');
