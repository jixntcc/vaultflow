
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  calculateFinancialIntelligence,
  detectRecurringExpenses,
  calculateGoalProjections,
  calculateHabitSnapshot,
  buildInsights,
  searchAll
} = require('../services/phase4-intelligence');

const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root,'server.js'),'utf8');
const html = fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const store = fs.readFileSync(path.join(root,'public/js/core/store.js'),'utf8');

const transactions = [
  { _id:'t1', type:'income', amount:100000, date:'2026-07-01', category:'Salary' },
  { _id:'t2', type:'expense', amount:5000, date:'2026-07-02', category:'Rent' },
  { _id:'t3', type:'expense', amount:5000, date:'2026-08-01', category:'Rent' },
  { _id:'t4', type:'expense', amount:5000, date:'2026-09-01', category:'Rent' },
  { _id:'t5', type:'expense', amount:30000, date:'2026-08-05', category:'Shopping' }
];
const goals=[{_id:'g1',name:'Emergency Fund',targetAmount:100000,currentAmount:20000,deadline:'2026-10-01'}];
const habits=[{_id:'h1',name:'Read',status:'active'}];
const logs=[{_id:'l1',habitId:'h1',scheduledDate:new Date().toISOString().slice(0,10),status:'completed'}];

const financial=calculateFinancialIntelligence(transactions,new Date('2026-08-10T12:00:00Z'));
assert(financial.totals.income===100000);
assert(financial.totals.expenses===45000);
assert(financial.totals.netSavings===55000);
assert(financial.anomalies.length>=1);

const recurring=detectRecurringExpenses(transactions);
assert(recurring.some(x=>x.category==='Rent'));

const projections=calculateGoalProjections(goals,transactions,new Date('2026-08-10T12:00:00Z'));
assert(projections[0].remaining===80000);
assert(['at-risk','on-track'].includes(projections[0].status));

const habit=calculateHabitSnapshot(habits,logs,new Date());
assert(habit.activeHabits===1);

const insights=buildInsights(financial,projections,habit,recurring);
assert(Array.isArray(insights));

const results=searchAll('rent',{transactions,vaults:[],goals,habits});
assert(results.length>=1 && results[0].type==='transaction');

const staticChecks=[
  [/\/api\/insights/, 'insights route'],
  [/\/api\/goals\/projections/, 'goal projection route'],
  [/\/api\/search/, 'global search route'],
  [/\/api\/audit/, 'audit route'],
  [/\/api\/automation\/rules/, 'automation routes'],
  [/\/api\/sync\/mutations/, 'sync route'],
  [/AuditEvent/, 'audit model'],
  [/AutomationRule/, 'automation model'],
  [/MutationReceipt/, 'idempotency model'],
  [/phase4-dashboard-grid/, 'dashboard intelligence UI'],
  [/phase4CommandPalette/, 'command palette UI'],
  [/automationRules/, 'automation backup'],
  [/setIntelligence/, 'Store intelligence state']
];
for(const [pattern,name] of staticChecks) assert(pattern.test(server+html+store),`Missing ${name}`);

console.log('VaultFlow Phase 4 platform assertions passed.');
