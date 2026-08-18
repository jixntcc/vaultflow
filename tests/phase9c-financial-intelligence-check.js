'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'css', 'app.css'), 'utf8');

assert(html.includes('id="phase9cSignalGrid"'), 'Financial intelligence signal grid missing.');
assert(html.includes('function buildFinancialIntelligenceSignals(data)'), 'Financial intelligence signal engine missing.');
assert(html.includes('function renderFinancialIntelligenceSignals(data)'), 'Financial intelligence signal renderer missing.');
assert(html.includes('renderFinancialIntelligenceSignals(data);'), 'Signal renderer not wired into intelligence refresh.');
assert(html.includes('data.financial?.totals'), 'Signals must use existing financial totals.');
assert(html.includes('data.financial?.health'), 'Signals must use existing financial health model.');
assert(html.includes('data.financial?.forecast'), 'Signals must use existing financial forecast model.');
assert(html.includes('expenseGrowth'), 'Spending trend signal missing.');
assert(html.includes('incomeGrowth'), 'Income trend signal missing.');
assert(html.includes('projectedMonthlySurplus'), 'Cash-flow projection signal missing.');
assert(html.includes('savingsRate'), 'Savings-rate signal missing.');
assert(html.includes('data-vf-action="switch-page"'), 'Signals must use shared navigation action contracts.');
assert(html.includes('data-intelligence-action="refresh"'), 'Refresh must use existing intelligence action contract.');

assert(css.includes('Phase 9C — Financial Intelligence'), 'Phase 9C CSS missing.');
assert(css.includes('grid-template-columns: repeat(3, minmax(0, 1fr));'), 'Desktop signal grid missing.');
assert(css.includes('@media (max-width: 768px)'), 'Mobile intelligence breakpoint missing.');
assert(css.includes('min-height: 44px'), 'Mobile intelligence controls need touch-friendly targets.');

assert(!html.match(/\bon(?:click|change|input|submit|keydown|keyup)\s*=/i), 'Inline event handlers returned.');
console.log('Phase 9C Financial Intelligence assertions passed.');
