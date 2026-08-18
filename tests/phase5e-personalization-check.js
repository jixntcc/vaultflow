
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

assert(service.includes('function buildPersonalizationProfile'), 'personalization engine missing');
assert(service.includes('priorities'), 'personalization priority ranking missing');
assert(service.includes('dataQuality'), 'personalization data quality missing');
assert(server.includes('buildPersonalizationProfile'), 'server does not build personalization');
assert(server.includes('personalization, insights'), 'insights API does not expose personalization');
assert(store.includes('function setPersonalization'), 'Store personalization setter missing');
assert(store.includes('setIntelligence, setPersonalization'), 'Store personalization contract not exported');
assert(html.includes('id="dashboardPersonalizedFocus"'), 'dashboard personalization surface missing');
assert(html.includes('id="personalizationProfile"'), 'intelligence personalization surface missing');
assert(html.includes('function renderPersonalizationProfile'), 'personalization renderer missing');
assert(html.includes('function renderDashboardPersonalization'), 'dashboard personalization renderer missing');
assert(html.includes('VaultFlowStore.setPersonalization'), 'personalization is not persisted in Store');
assert(css.includes('.personalization-profile'), 'personalization styles missing');
assert(css.includes('.personalized-focus-inner'), 'dashboard personalization styles missing');

console.log('Phase 5E Personalization assertions passed.');
