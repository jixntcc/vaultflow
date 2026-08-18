
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'css', 'app.css'), 'utf8');
const store = fs.readFileSync(path.join(root, 'public', 'js', 'core', 'store.js'), 'utf8');
const service = fs.readFileSync(path.join(root, 'services', 'phase4-intelligence.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

assert(service.includes('function buildRetentionProfile'), 'retention engine missing');
assert(service.includes('weeklyReview'), 'weekly review model missing');
assert(service.includes('milestones'), 'milestone model missing');
assert(service.includes('privacy'), 'retention privacy contract missing');
assert(server.includes('buildRetentionProfile'), 'server does not build retention profile');
assert(server.includes('retention, insights'), 'insights API does not expose retention');
assert(store.includes('function setRetention'), 'Store retention setter missing');
assert(store.includes('setPersonalization, setRetention'), 'Store retention contract not exported');
assert(html.includes('id="dashboardWeeklyReview"'), 'dashboard weekly review surface missing');
assert(html.includes('id="retentionProfile"'), 'retention profile surface missing');
assert(html.includes('function renderRetentionProfile'), 'retention renderer missing');
assert(html.includes('function renderDashboardWeeklyReview'), 'dashboard retention renderer missing');
assert(html.includes('VaultFlowStore.setRetention'), 'retention is not persisted in Store');
assert(css.includes('.retention-profile'), 'retention styles missing');
assert(css.includes('.weekly-review-inner'), 'weekly review styles missing');

console.log('Phase 5F Growth / Retention assertions passed.');
