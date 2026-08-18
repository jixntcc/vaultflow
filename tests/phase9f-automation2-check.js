'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'css', 'app.css'), 'utf8');

const events = ['goal_at_risk','expense_threshold','habit_streak','weekly_summary','financial_health_drop','savings_rate_below','habit_finance_signal'];

for (const event of events) {
  assert(server.includes(event), `Automation event missing: ${event}`);
  assert(html.includes(`value="${event}"`), `Automation UI event missing: ${event}`);
}

assert(server.includes('function getAutomationOccurrenceKey(rule, now, context = {})'), 'Durable occurrence-key function missing.');
assert(server.includes('rule.event === \'weekly_summary\''), 'Weekly semantic occurrence missing.');
assert(server.includes('habit-finance:${dateKey}'), 'Habit-finance daily occurrence key missing.');
assert(server.includes('getAutomationOccurrenceKey(rule, now, occurrenceContext)'), 'Evaluator must use semantic occurrence keys.');
assert(!server.includes('automation:${rule._id}:${now.toISOString().slice(0,13)}'), 'Old hourly trigger key remains.');
assert(server.includes('AutomationTrigger'), 'Durable automation trigger store missing.');
assert(server.includes('automationTriggerSchema.index({ ruleId: 1, key: 1 }, { unique: true })'), 'Automation trigger uniqueness invariant missing.');

assert(server.includes('calculateFinanceHabitCorrelation(snapshot.transactions, snapshot.habits, snapshot.habitLogs, now)'), 'Automation must consume existing habit-finance intelligence.');
assert(server.includes('financial.health?.score'), 'Financial-health automation must consume existing health model.');
assert(server.includes('financial.totals?.savingsRate'), 'Savings-rate automation must consume existing financial model.');

assert(server.includes("AutomationRule.findOneAndUpdate(\n      { _id: req.params.id, userId: req.user.userId }"), 'Rule updates must remain ownership scoped.');
assert(server.includes("AutomationRule.findOneAndDelete({ _id: req.params.id, userId: req.user.userId })"), 'Rule deletes must remain ownership scoped.');
assert(server.includes("AutomationRule.find({ userId: req.user.userId })"), 'Rule reads must remain ownership scoped.');

assert(html.includes('automation2-explainer'), 'Automation 2.0 explanation missing.');
assert(html.includes("document.getElementById('phase4RuleAction')?.value || 'push'"), 'UI must preserve selected notification action.');
assert(css.includes('Phase 9F — Automation 2.0'), 'Phase 9F CSS missing.');
assert(css.includes('min-height: 44px'), 'Automation controls need touch-friendly sizing.');

assert(!html.match(/\bon(?:click|change|input|submit|keydown|keyup)\s*=/i), 'Inline event handlers returned.');
console.log('Phase 9F Automation 2.0 assertions passed.');
