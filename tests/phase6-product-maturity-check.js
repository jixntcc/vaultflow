
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

assert(service.includes('const VAULTFLOW_PLANS'), 'plan registry missing');
assert(service.includes('function buildPlanProfile'), 'plan profile missing');
assert(service.includes('billingReady'), 'billing readiness contract missing');
assert(server.includes('subscriptionPlan:'), 'subscription plan field missing');
assert(server.includes("app.get('/api/account/plan'"), 'account plan endpoint missing');
assert(server.includes('buildPlanProfile'), 'server plan builder missing');
assert(server.includes('plan });'), 'insights response does not expose plan');
assert(store.includes('account: { plan: null }'), 'account store state missing');
assert(store.includes('function setPlan'), 'plan Store setter missing');
assert(store.includes('setRetention, setPlan'), 'plan Store contract not exported');
assert(html.includes('id="accountPlanCard"'), 'settings plan card missing');
assert(html.includes('id="planModal"'), 'plan modal missing');
assert(html.includes('function renderAccountPlan'), 'plan renderer missing');
assert(html.includes('function openPlanModal'), 'plan modal action missing');
assert(html.includes('id="dashboardActivationChecklist"'), 'activation checklist missing');
assert(html.includes('function renderActivationChecklist'), 'activation renderer missing');
assert(css.includes('.phase6-plan-card'), 'plan styles missing');
assert(css.includes('.activation-card'), 'activation styles missing');

console.log('Phase 6 Product Maturity assertions passed.');
