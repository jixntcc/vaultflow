
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'css', 'app.css'), 'utf8');
const store = fs.readFileSync(path.join(root, 'public', 'js', 'core', 'store.js'), 'utf8');

assert(store.includes('function getHabits()'), 'Habit Store getter missing.');
assert(store.includes('function setHabits('), 'Habit Store setter missing.');
assert(store.includes('function updateHabit('), 'Habit Store update missing.');
assert(store.includes('function removeHabit('), 'Habit Store remove missing.');
assert(store.includes('getHabits, setHabits,'), 'Habit Store read contract not exported.');
assert(store.includes('addHabit, updateHabit, removeHabit,'), 'Habit Store mutation contract not exported.');

assert(html.includes('function buildHabitViewModel('), 'Habit view model missing.');
assert(html.includes('function buildHabitActionContract('), 'Habit action contract missing.');
assert(html.includes('function renderHabitActions('), 'Habit action renderer missing.');
assert(html.includes('function renderHabitCard('), 'Shared Habit card renderer missing.');
assert(html.includes("data-habit-action-type=\"${key}\""), 'Habit action data contract missing.');
assert(html.includes('data-habit-action-type][data-habit-id]'), 'Delegated Habit action handler missing.');
assert(html.includes("renderHabitCard(m,date,mode)"), 'Desktop/mobile Habit renderer selection missing.');
assert(html.includes("VaultFlowStore.updateHabit(saved"), 'Archive path must update Store.');

assert(css.includes('.habit-actions-mobile'), 'Mobile Habit action layout missing.');
assert(css.includes('.habit-actions [data-habit-action-type]'), 'Habit touch-target baseline missing.');

console.log('Phase 7B Habits contract assertions passed.');
