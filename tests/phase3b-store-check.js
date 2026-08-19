const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const store = fs.readFileSync(path.join(root, 'public/js/core/store.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const engine = fs.readFileSync(path.join(root, 'public/js/core/habit-domain.js'), 'utf8');

for (const token of [
  'function getHabits()',
  'function setHabits(',
  'function getHabitLogs()',
  'function setHabitLogs(',
  'function addHabit(',
  'function addOrUpdateHabitLog(',
  'function removeHabitLog('
]) assert.ok(store.includes(token), token);

for (const token of [
  'function getTodayLocalDate',
  'function isScheduledOn',
  'function getHabitStatus',
  'function getHabitStreak',
  'function getHabitCompletionRate',
  'function buildHabitViewModel',
  'function buildTodaySummary'
]) assert.ok(engine.includes(token), token);

assert.ok(html.includes('/js/core/habit-domain.js'));
assert.ok(html.includes('async function loadHabits()'));
assert.ok(html.includes('async function loadHabitLogs('));
assert.ok(html.includes('setHabits([]);'));
assert.ok(html.includes('setHabitLogs([]);'));

console.log('VaultFlow Phase 3B Store assertions passed.');
