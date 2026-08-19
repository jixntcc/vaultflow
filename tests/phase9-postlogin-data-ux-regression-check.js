'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'css', 'app.css'), 'utf8');
const api = fs.readFileSync(path.join(root, 'public', 'js', 'core', 'api-client.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'public', 'sw.js'), 'utf8');

assert(html.includes('async function loadReports()'), 'Reports loader must be awaitable.');
assert(html.includes('const transactions = getTransactions();'), 'Reports must use Store transactions, not an undeclared global.');
assert(html.includes('await applyReportFilters();'), 'Reports loader must await rendering so failures are caught.');
assert(html.includes('finally {'), 'Reports loader must always release loading state.');
assert(html.includes("VaultFlowStore.setReportsLoading(false);"), 'Reports loading state must always be cleared.');
assert(html.includes('showReportsError(error)'), 'Reports must expose a visible error state.');
assert(html.includes('buildAnalyticsFromTransactions(getTransactions())'), 'Reports must have a transaction-based fallback.');

assert(css.includes('overflow-y: auto;'), 'Document must explicitly permit vertical scrolling.');
assert(css.includes('min-height: 100%;'), 'Document must have an unconstrained minimum height.');
assert(css.includes('body.mobile-nav-open { overflow: hidden;'), 'Scroll locking must only apply to the open mobile drawer.');

assert(api.includes('DEFAULT_TIMEOUT_MS = 15000'), 'API requests need a bounded timeout.');
assert(api.includes("code = 'REQUEST_TIMEOUT'"), 'Timeouts need a machine-readable error code.');

assert(sw.includes("vaultflow-shell-v3"), 'Service worker cache must be bumped after frontend fixes.');

console.log('Phase 9 post-login Data/UX regression assertions passed.');
