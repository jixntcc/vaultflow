
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'css', 'app.css'), 'utf8');
const store = fs.readFileSync(path.join(root, 'public', 'js', 'core', 'store.js'), 'utf8');
const service = fs.readFileSync(path.join(root, 'services', 'phase4-intelligence.js'), 'utf8');

assert(html.includes('Phase 5D'), 'Phase 5D page marker missing');
assert(html.includes('id="goalsTotalTarget"'), 'goal target KPI missing');
assert(html.includes('id="goalsTotalProgress"'), 'goal progress KPI missing');
assert(html.includes('id="goalsFocus"'), 'goal focus surface missing');
assert(html.includes('data-goal-filter="active"'), 'goal active filter missing');
assert(html.includes('data-goal-filter="at-risk"'), 'goal risk filter missing');
assert(html.includes('function goalProjectionFor'), 'projection adapter missing');
assert(html.includes('function goalNextMilestone'), 'milestone logic missing');
assert(html.includes('refreshPhase4Insights(true)'), 'goal mutation projection refresh missing');
assert(store.includes('function getGoals()'), 'Goals Store getter missing');
assert(store.includes('function setGoals('), 'Goals Store setter missing');
assert(store.includes('getGoals, setGoals'), 'Goals Store contract not exported');
assert(service.includes('function calculateGoalProjections'), 'goal projection engine missing');
assert(css.includes('.goals-experience-grid'), 'Goals experience styles missing');
assert(css.includes('.goal-experience-card'), 'goal card styles missing');
assert(css.includes('.goals-command-grid'), 'goal KPI styles missing');

console.log('Phase 5D Goals Experience assertions passed.');
