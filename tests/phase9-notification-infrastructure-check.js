'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');

assert(!vercel.crons, 'Native Vercel cron configuration must be removed when using an external scheduler.');

assert(server.includes("app.get('/api/cron/notifications'"), 'Notification cron endpoint missing.');
assert(server.includes("auth !== `Bearer ${expected}`"), 'Cron endpoint must validate CRON_SECRET bearer authentication.');
assert(server.includes("[NotificationCron] started"), 'Notification start logging missing.');
assert(server.includes("[NotificationCron] finished"), 'Notification completion logging missing.');

for (const setting of ['dailyReminder', 'weeklySummary', 'savingsInsights', 'habitReminder', 'habitWeeklySummary', 'habitRisk']) {
  assert(server.includes(`settings.${setting}`), `Notification setting is not consumed by the background job: ${setting}`);
}

assert(server.includes('finance-daily:'), 'Daily finance reminder key missing.');
assert(server.includes('finance-weekly:'), 'Weekly finance summary key missing.');
assert(server.includes('finance-savings:'), 'Savings insight key missing.');
assert(server.includes('habit-reminder:'), 'Habit reminder key missing.');
assert(server.includes('habit-risk:'), 'Habit risk key missing.');
assert(server.includes('habit-weekly:'), 'Habit weekly key missing.');

assert(server.includes('status: \'failed\''), 'Failed notification status missing.');
assert(server.includes('status: \'failed\'') && server.includes('findOneAndUpdate'), 'Failed notification reclaim path missing.');
assert(server.includes('notificationDeliverySchema.index({ userId: 1, subscriptionId: 1, key: 1 }, { unique: true })'),
  'Notification delivery unique idempotency index missing.');

assert(server.includes('const financeHour = 18'), 'Finance notification delivery window is not explicit.');
assert(server.includes("parts.weekday === 'Sun' && parts.hour >= financeHour"), 'Weekly notification timezone window missing.');

assert(html.includes('Daily tracking reminders'), 'Daily notification setting UI missing.');
assert(html.includes('Weekly summary'), 'Weekly notification setting UI missing.');
assert(html.includes('Savings insights'), 'Savings notification setting UI missing.');

assert(!/\bon(?:click|change|input|submit|keydown|keyup)\s*=/.test(html), 'Inline event handlers detected.');

console.log('Phase Notification Infrastructure 2.0 assertions passed.');
