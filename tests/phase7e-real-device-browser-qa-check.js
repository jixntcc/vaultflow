
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'css', 'app.css'), 'utf8');

const head = html.slice(0, html.toLowerCase().indexOf('</head>'));
const viewport = head.match(/<meta\s+name=["']viewport["'][^>]*>/gi) || [];
assert.strictEqual(viewport.length, 1, 'Exactly one document-head viewport declaration is required.');

assert(html.includes('id="dashboardTotalTransactions"'), 'Dashboard fifth summary metric is missing.');
assert(html.includes("set('dashboardTotalTransactions'"), 'Dashboard transaction count is not populated from the existing transaction source.');

const grid = css.match(/\.dashboard-overview-grid\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
assert(grid, 'Standard desktop dashboard must use five equal summary columns.');

assert(css.includes('@media (min-width: 769px) and (max-width: 1050px)'), 'Tablet desktop breakpoint missing.');
assert(css.includes('@media (max-width: 768px)'), 'Mobile breakpoint missing.');
assert(css.includes('grid-template-columns:repeat(2, minmax(0, 1fr));'), 'Mobile dashboard must use a two-column summary grid.');
assert(css.includes('grid-column:span 2;'), 'Primary dashboard card mobile span missing.');

const inlineEvents = html.match(/\bon(?:click|change|input|submit|keydown|keyup|focus|blur)\s*=/gi) || [];
assert.strictEqual(inlineEvents.length, 0, 'Inline event attributes must remain eliminated.');

console.log('Phase 7E Real Device Browser QA/layout contract assertions passed.');
