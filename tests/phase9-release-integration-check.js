'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const service = fs.readFileSync(path.join(root, 'services', 'phase4-intelligence.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'css', 'app.css'), 'utf8');

const {
  calculateFinancialIntelligence,
  calculateHabitSnapshot,
  calculateFinanceHabitCorrelation,
  buildPersonalizationProfile,
  searchAll
} = require(path.join(root, 'services', 'phase4-intelligence'));

const now = new Date('2026-08-18T12:00:00Z');
const transactions = [
  { _id:'tx1', type:'income', amount:100000, category:'Salary', date:'2026-08-01' },
  { _id:'tx2', type:'expense', amount:12000, category:'Food', date:'2026-08-10' },
  { _id:'tx3', type:'expense', amount:5000, category:'Travel', date:'2026-08-11', notes:'vacation' }
];
const vaults = [{ _id:'v1', name:'Emergency', description:'Emergency fund', percentage:20 }];
const goals = [{ _id:'g1', name:'Vacation', notes:'Kerala trip', status:'active', targetAmount:50000 }];
const habits = [{ _id:'h1', name:'No impulse spending', description:'Avoid impulse purchases', category:'finance', frequency:'daily', status:'active' }];
const habitLogs = Array.from({length:8}, (_,i) => ({
  _id:`hl${i}`, habitId:'h1', scheduledDate:`2026-08-${String(i+1).padStart(2,'0')}`, completed:i < 6
}));
const automationRules = [{
  _id:'a1', name:'Savings guard', event:'savings_rate_below', condition:{threshold:10}, enabled:true
}];

const financial = calculateFinancialIntelligence(transactions, now);
const habitsSnapshot = calculateHabitSnapshot(habits, habitLogs, now);
const financeHabit = calculateFinanceHabitCorrelation(transactions, habits, habitLogs, now);
const personalization = buildPersonalizationProfile(financial, goals, habitsSnapshot, financeHabit, now);
const search = searchAll('vacation', {
  transactions, vaults, goals, habits, habitLogs, automationRules,
  intelligence: { ...financial, habits: habitsSnapshot, financeHabit }
});

assert(financial && financial.totals, 'Financial intelligence did not compose.');
assert(habitsSnapshot && typeof habitsSnapshot.overallCompletionRate === 'number', 'Habit intelligence did not compose.');
assert(financeHabit && typeof financeHabit.observedDays === 'number', 'Habit-finance intelligence did not compose.');
assert(personalization && personalization.mode && Array.isArray(personalization.priorities), 'Personalization did not compose.');
assert(search.some(r => r.type === 'goal' && r.id === 'g1'), 'Universal search did not find the goal.');
assert(search.every(r => r.id), 'Universal search returned an invalid result contract.');

assert(server.includes("app.get('/api/search'"), 'Search route missing.');
assert(server.includes('AutomationRule.find({ userId }).lean()'), 'Search snapshot is not automation-aware.');
assert(server.includes('getAutomationOccurrenceKey(rule, now, occurrenceContext)'), 'Automation semantic idempotency is missing.');
assert(server.includes('userId: req.user.userId'), 'User ownership contract is missing.');

assert(html.includes('dashboardPersonalizedFocus'), 'Personalization dashboard contract missing.');
assert(html.includes('phase4CommandPalette'), 'Universal search UI missing.');
assert(html.includes('data-vf-action="command-result"'), 'Search action contract missing.');
assert(!/\bon(?:click|change|input|submit|keydown|keyup)\s*=/.test(html), 'Inline event handlers detected.');

assert(/grid-template-columns\s*:\s*repeat\(\s*5\s*,/.test(css), 'Desktop dashboard five-column layout missing.');
assert(/@media\s*\(max-width:\s*768px\)/.test(css), 'Mobile responsive breakpoint missing.');

console.log('Phase 9 Release Integration / Product Cohesion assertions passed.');
console.log(`Composed flow: finance=${financial.totals.savingsRate}% | habits=${habitsSnapshot.overallCompletionRate}% | personalization=${personalization.mode} | search=${search.length} result(s)`);
