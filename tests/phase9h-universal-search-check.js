'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const service = fs.readFileSync(path.join(root, 'services', 'phase4-intelligence.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'css', 'app.css'), 'utf8');

assert(server.includes("app.get('/api/search'"), 'Universal search endpoint missing.');
assert(server.includes('AutomationRule.find({ userId }).lean()'), 'Search snapshot must include user-owned automation rules.');
assert(server.includes('calculateFinancialIntelligence(snapshot.transactions, now)'), 'Search route must derive financial intelligence from the user snapshot.');
assert(server.includes('calculateHabitSnapshot(snapshot.habits, snapshot.habitLogs, now)'), 'Search route must derive habit intelligence from the user snapshot.');
assert(server.includes('calculateFinanceHabitCorrelation(snapshot.transactions, snapshot.habits, snapshot.habitLogs, now)'), 'Search route must derive habit-finance intelligence.');

assert(service.includes('function searchAll(query'), 'Universal search engine missing.');
for (const type of ['transaction','vault','goal','habit','automation','intelligence']) {
  assert(service.includes(`add('${type}'`), `Search type missing: ${type}`);
}
assert(service.includes('scoreText'), 'Search ranking helper missing.');
assert(service.includes('slice(0, 30)'), 'Search result limit missing.');

assert(html.includes('data-vf-action="open-command-palette"'), 'Search open action contract missing.');
assert(html.includes('id="phase4CommandPalette"'), 'Search palette missing.');
assert(html.includes('id="phase4CommandInput"'), 'Search input missing.');
assert(html.includes('data-vf-action="command-result"'), 'Search result action contract missing.');
assert(html.includes('automation'), 'Automation search presentation missing.');
assert(html.includes('intelligence'), 'Intelligence search presentation missing.');
assert(html.includes('searchRequestId'), 'Stale search request protection missing.');
assert(html.includes('Ctrl K'), 'Desktop keyboard shortcut hint missing.');

assert(css.includes('Phase 9H — Universal Search'), 'Phase 9H CSS missing.');
assert(css.includes('global-search-btn'), 'Global search button styling missing.');
assert(css.includes('phase4-command-result'), 'Search result styling missing.');
assert(css.includes('@media (max-width: 768px)'), 'Mobile search breakpoint missing.');
assert(css.includes('min-height: 44px'), 'Mobile search controls need touch-friendly sizing.');

assert(!html.match(/\bon(?:click|change|input|submit|keydown|keyup)\s*=/i), 'Inline event handlers returned.');
console.log('Phase 9H Universal Search assertions passed.');
