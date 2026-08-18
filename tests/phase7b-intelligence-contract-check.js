
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'css', 'app.css'), 'utf8');
const store = fs.readFileSync(path.join(root, 'public', 'js', 'core', 'store.js'), 'utf8');

assert(store.includes('function getIntelligence()'), 'Intelligence Store getter missing.');
assert(store.includes('getReports, setReports, setReportsLoading, getIntelligence'), 'Intelligence Store contract not exported.');

assert(html.includes('function buildIntelligenceViewModel('), 'Intelligence view model missing.');
assert(html.includes('function buildIntelligenceActionContract('), 'Intelligence action contract missing.');
assert(html.includes('function renderIntelligenceActions('), 'Intelligence action renderer missing.');
assert(html.includes('function renderPhase4InsightView('), 'Intelligence view renderer missing.');
assert(html.includes('id="intelligenceActionHost"'), 'Intelligence action host missing.');
assert(html.includes('data-intelligence-action="refresh"'), 'Intelligence refresh action missing.');
assert(html.includes('data-intelligence-action="search"'), 'Intelligence search action missing.');
assert(html.includes('data-intelligence-action="review-habits"'), 'Intelligence Habit action missing.');
assert(html.includes('data-intelligence-action="create-automation"'), 'Intelligence automation action missing.');
assert(html.includes('data-intelligence-action="refresh-audit"'), 'Intelligence audit action missing.');
assert(html.includes('data-intelligence-action]'), 'Delegated Intelligence action handler missing.');
assert(html.includes('VaultFlowStore.setIntelligence(data)'), 'Intelligence API result must enter Store.');
assert(html.includes('buildIntelligenceViewModel(data)'), 'Intelligence must cross the View Model boundary.');

assert(css.includes('.phase4-header-actions [data-intelligence-action]'), 'Mobile Intelligence touch-target baseline missing.');

console.log('Phase 7B Intelligence contract assertions passed.');
