
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'css', 'app.css'), 'utf8');
const store = fs.readFileSync(path.join(root, 'public', 'js', 'core', 'store.js'), 'utf8');

assert(store.includes('function getGoals()'), 'Goal Store getter missing.');
assert(store.includes('function setGoals('), 'Goal Store setter missing.');
assert(store.includes('function upsertGoal('), 'Goal Store upsert missing.');
assert(store.includes('function removeGoal('), 'Goal Store remove missing.');
assert(store.includes('getGoals, setGoals, upsertGoal, removeGoal'), 'Goal Store contract not exported.');

assert(html.includes('function buildGoalViewModel('), 'Goal view model missing.');
assert(html.includes('function buildGoalActionContract('), 'Goal action contract missing.');
assert(html.includes('function renderGoalCard('), 'Shared Goal card renderer missing.');
assert(html.includes('data-goal-action="open"'), 'Goal open action missing.');
assert(html.includes('data-goal-action="edit"'), 'Goal edit action missing.');
assert(html.includes('data-goal-action="delete"'), 'Goal delete action missing.');
assert(html.includes('data-goal-action][data-goal-id]'), 'Delegated Goal action handler missing.');
assert(html.includes('VaultFlowStore.removeGoal(id'), 'Delete path must update Store before reload.');
assert(html.includes('renderGoalCard(vm, window.innerWidth <= 768 ?'), 'Desktop/mobile Goal render selection missing.');

assert(css.includes('.goal-experience-actions-mobile'), 'Mobile Goal action layout missing.');
assert(css.includes('.goal-experience-actions [data-goal-action]'), 'Goal touch-target baseline missing.');

console.log('Phase 7B Goals contract assertions passed.');
