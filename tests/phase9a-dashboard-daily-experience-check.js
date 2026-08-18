'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'css', 'app.css'), 'utf8');

assert(html.includes('id="dashboard" class="page active"'), 'Dashboard page missing.');
assert(html.includes('id="dashboardTodayHabits"'), 'Daily habit summary missing.');
assert(html.includes('id="dashboardTodayGoal"'), 'Daily goal summary missing.');
assert(html.includes('id="dashboardTodaySpend"'), 'Daily spending summary missing.');
assert(html.includes('id="dashboardTodayFocus"'), 'Daily focus summary missing.');
assert(html.includes('function renderDashboardToday('), 'Daily dashboard renderer missing.');
assert(html.includes('renderDashboardToday(monthTransactions, habitSummary, getGoals(), intelligence);'), 'Daily dashboard renderer not wired into renderDashboard.');
assert(html.includes('HabitDomain.buildTodaySummary'), 'Dashboard must use the existing Habit domain engine.');
assert(html.includes('getGoals()'), 'Dashboard must use the existing Goals domain/store.');
assert(html.includes('getTransactions()'), 'Dashboard must use the existing Transactions source.');
assert(html.includes('data-vf-action="switch-page"'), 'Daily dashboard actions must use shared action contracts.');

assert(css.includes('grid-template-columns: repeat(4, minmax(0, 1fr));'), 'Desktop daily grid missing.');
assert(css.includes('@media (max-width: 768px)'), 'Mobile dashboard breakpoint missing.');
assert(css.includes('@media (max-width: 480px)'), 'Small-mobile dashboard breakpoint missing.');
assert(css.includes('min-height: 76px'), 'Mobile daily cards need a touch-friendly height.');

assert(!html.match(/\bon(?:click|change|input|submit|keydown|keyup)\s*=/i), 'Inline event handlers returned.');
console.log('Phase 9A Dashboard / Daily Experience assertions passed.');
