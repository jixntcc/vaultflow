const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const engine = fs.readFileSync(require('path').join(__dirname, '..', 'public/js/core/habit-domain.js'), 'utf8');

const state = {
  habits: {
    items: [],
    logs: []
  }
};

const context = {
  console,
  Date,
  VaultFlowStore: {
    getHabits: () => state.habits.items,
    getHabitLogs: () => state.habits.logs
  }
};
context.window = context;
vm.runInNewContext(engine, context);

const D = context.HabitDomain;

assert.strictEqual(D.addDays('2026-08-16', 1), '2026-08-17');
assert.strictEqual(D.addDays('2026-08-31', 1), '2026-09-01');
assert.strictEqual(D.dayOfWeek('2026-08-16'), 0); // Sunday
assert.strictEqual(D.dayOfWeek('2026-08-17'), 1); // Monday

const daily = {
  _id: 'h1',
  name: 'Read',
  status: 'active',
  startDate: '2026-08-14',
  frequency: { type: 'daily' }
};
const weekly = {
  _id: 'h2',
  name: 'Exercise',
  status: 'active',
  startDate: '2026-08-01',
  frequency: { type: 'weekly', daysOfWeek: [1,3,5], targetPerWeek: 3 }
};

state.habits.items = [daily, weekly];

assert.strictEqual(D.isScheduledOn(daily, '2026-08-16'), true);
assert.strictEqual(D.isScheduledOn(weekly, '2026-08-17'), true);
assert.strictEqual(D.isScheduledOn(weekly, '2026-08-18'), false);

state.habits.logs = [
  {_id:'l1', habitId:'h1', scheduledDate:'2026-08-14', status:'completed'},
  {_id:'l2', habitId:'h1', scheduledDate:'2026-08-15', status:'completed'},
  {_id:'l3', habitId:'h1', scheduledDate:'2026-08-16', status:'completed'}
];

assert.strictEqual(D.getHabitStatus('h1','2026-08-16'), 'completed');
assert.strictEqual(D.getHabitStatus('h1','2026-08-13'), 'not_scheduled');
assert.strictEqual(D.getHabitStatus('h1','2026-08-12'), 'not_scheduled');

const dailyStreak = D.getHabitStreak('h1','2026-08-16');
assert.strictEqual(dailyStreak.current, 3);
assert.strictEqual(dailyStreak.best, 3);

state.habits.logs = [
  {_id:'w1', habitId:'h2', scheduledDate:'2026-08-03', status:'completed'},
  {_id:'w2', habitId:'h2', scheduledDate:'2026-08-05', status:'completed'},
  {_id:'w3', habitId:'h2', scheduledDate:'2026-08-07', status:'completed'},
  {_id:'w4', habitId:'h2', scheduledDate:'2026-08-10', status:'completed'},
  {_id:'w5', habitId:'h2', scheduledDate:'2026-08-12', status:'completed'},
  {_id:'w6', habitId:'h2', scheduledDate:'2026-08-14', status:'completed'}
];

const weeklyStreak = D.getHabitStreak('h2','2026-08-16');
assert.strictEqual(weeklyStreak.current, 2);
assert.strictEqual(weeklyStreak.unit, 'weeks');

state.habits.logs = [
  {_id:'l1', habitId:'h1', scheduledDate:'2026-08-14', status:'completed'},
  {_id:'l2', habitId:'h1', scheduledDate:'2026-08-15', status:'completed'},
  {_id:'l3', habitId:'h1', scheduledDate:'2026-08-16', status:'completed'}
];

const rate = D.getHabitCompletionRate('h1','2026-08-14','2026-08-16');
assert.strictEqual(rate.completed, 3);
assert.strictEqual(rate.scheduled, 3);
assert.strictEqual(rate.rate, 100);

const pending = D.getHabitStatus('h1','2026-08-17');
assert.strictEqual(pending, 'pending');

const skippedLogs = [
  {_id:'s1', habitId:'h1', scheduledDate:'2026-08-14', status:'completed'},
  {_id:'s2', habitId:'h1', scheduledDate:'2026-08-15', status:'skipped'}
];
assert.strictEqual(D.getHabitStatus('h1','2026-08-15', state.habits.items, skippedLogs), 'skipped');

const schedule = D.getScheduledDates(weekly, '2026-08-17', '2026-08-23');
assert.strictEqual(JSON.stringify(schedule), JSON.stringify(['2026-08-17','2026-08-19','2026-08-21']));

console.log('VaultFlow Phase 3B Habit Domain assertions passed.');
