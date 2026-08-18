
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'css', 'app.css'), 'utf8');
const store = fs.readFileSync(path.join(root, 'public', 'js', 'core', 'store.js'), 'utf8');

assert(store.includes('function getReports()'), 'Reports Store getter missing.');
assert(store.includes('function setReports('), 'Reports Store setter missing.');
assert(store.includes('function setReportsLoading('), 'Reports loading Store setter missing.');
assert(store.includes('getReports, setReports, setReportsLoading'), 'Reports Store contract not exported.');

assert(html.includes('function buildReportViewModel('), 'Report view model missing.');
assert(html.includes('function buildReportActionContract('), 'Report action contract missing.');
assert(html.includes('function renderReportActions('), 'Report action renderer missing.');
assert(html.includes('function renderReportView('), 'Report view renderer missing.');
assert(html.includes('data-report-action="toggle-filters"'), 'Report filter action missing.');
assert(html.includes('data-report-action="apply-filters"'), 'Report apply action missing.');
assert(html.includes('data-report-action="refresh"'), 'Report refresh action missing.');
assert(html.includes('data-report-action]'), 'Delegated Report action handler missing.');
assert(html.includes('VaultFlowStore.setReports(data'), 'Report API response must enter Store.');
assert(html.includes('VaultFlowStore.getReports().data'), 'Report filtering must use Store read model as fallback.');

assert(css.includes('.report-action-host'), 'Report action host styles missing.');
assert(css.includes('.report-action-host [data-report-action]'), 'Mobile Report touch-target baseline missing.');

console.log('Phase 7B Reports contract assertions passed.');
