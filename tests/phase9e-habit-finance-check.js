'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'css', 'app.css'), 'utf8');
const engine = fs.readFileSync(path.join(root, 'services', 'phase4-intelligence.js'), 'utf8');

assert(html.includes('id="dashboardHabitFinance"'), 'Dashboard habit-finance panel missing.');
assert(html.includes('function renderHabitFinanceBrief(data'), 'Habit-finance brief renderer missing.');
assert(html.includes('data?.financeHabit'), 'Dashboard brief must consume existing financeHabit intelligence data.');
assert(html.includes('spendingDifferencePercent'), 'Spending difference signal missing.');
assert(html.includes('averageSpendingHighCompletion'), 'High-completion spending metric missing.');
assert(html.includes('averageSpendingLowCompletion'), 'Low-completion spending metric missing.');
assert(html.includes('habitScores'), 'Individual habit signal missing.');
assert(html.includes('This is an association, not proof that one causes the other.'), 'Causation disclaimer missing.');
assert(html.includes('data-vf-action="switch-page" data-vf-page="habits"'), 'Habit navigation must use shared action contract.');

assert(engine.includes('function calculateFinanceHabitCorrelation'), 'Finance-habit correlation engine missing.');
assert(engine.includes('highCompletionDays'), 'High-completion day grouping missing.');
assert(engine.includes('lowCompletionDays'), 'Low-completion day grouping missing.');
assert(engine.includes('spendingDifferencePercent'), 'Spending difference calculation missing.');
assert(engine.includes('habitScores'), 'Per-habit scoring missing.');
assert(engine.includes('correlation'), 'Correlation signal missing.');

assert(css.includes('Phase 9E — Habit ↔ Finance'), 'Phase 9E CSS missing.');
assert(css.includes('dashboard-habit-finance-grid'), 'Dashboard habit-finance grid styling missing.');
assert(css.includes('@media (max-width: 768px)'), 'Mobile habit-finance breakpoint missing.');
assert(css.includes('min-height: 44px'), 'Habit-finance mobile action needs touch-friendly sizing.');

assert(!html.match(/\bon(?:click|change|input|submit|keydown|keyup)\s*=/i), 'Inline event handlers returned.');
console.log('Phase 9E Habit ↔ Finance assertions passed.');
