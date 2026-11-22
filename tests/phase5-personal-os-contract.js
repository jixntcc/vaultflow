'use strict';
const assert = require('node:assert/strict');
const { createActivityItem, ACTIVITY_TYPES, ACTIVITY_MODULES } = require('../lib/activity-item');

assert.deepEqual(ACTIVITY_TYPES, ['transaction', 'habit', 'memory', 'note', 'portfolio']);
assert.deepEqual(ACTIVITY_MODULES, ['transactions', 'habits', 'memories', 'notes', 'portfolio']);

const item = createActivityItem({
  type: 'transaction',
  category: 'expense',
  title: 'Food',
  description: 'Lunch',
  date: '2026-11-22',
  time: '12:30',
  amount: '250',
  currency: 'inr',
  source: { module: 'transactions', recordId: 'abc123' },
  metadata: { wallet: 'HR' }
});
assert.equal(item.id, 'transactions:abc123');
assert.equal(item.amount, 250);
assert.equal(item.currency, 'INR');
assert.equal(item.date, '2026-11-22');
assert.equal(item.source.recordId, 'abc123');
assert.throws(() => createActivityItem({ ...item, type: 'unknown' }), /Unsupported ActivityItem type/);
assert.throws(() => createActivityItem({ ...item, source: { module: 'unknown', recordId: 'x' } }), /Unsupported ActivityItem source/);
assert.throws(() => createActivityItem({ ...item, date: '22-11-2026' }), /YYYY-MM-DD/);
assert.throws(() => createActivityItem({ ...item, amount: 'not-a-number' }), /finite/);
console.log('Personal OS ActivityItem contract: PASS');
