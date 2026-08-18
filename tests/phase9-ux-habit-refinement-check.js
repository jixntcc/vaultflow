'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'css', 'app.css'), 'utf8');
const habitDomain = fs.readFileSync(path.join(root, 'public', 'js', 'core', 'habit-domain.js'), 'utf8');

assert(html.includes('id="habitAnalyticsChart"'), 'Habit trend chart canvas missing.');
assert(html.includes('window.vaultFlowHabitChart'), 'Habit chart instance lifecycle missing.');
assert(html.includes('configureVaultFlowCharts'), 'Shared chart presentation configuration missing.');
assert(html.includes('Consistency trend'), 'Habit analytics trend section missing.');
assert(html.includes('Habit performance'), 'Habit performance section missing.');
assert(html.includes('completionRate: Number(rateWindow.rate'), 'Habit cards must show domain-derived 30-day consistency.');
assert(html.includes('data-habit-action-type="${key}"'), 'Shared habit action contract missing.');
assert(html.includes('setHabitOccurrence(id, actionButton.dataset.habitDate'), 'Habit completion action is wired.');
assert(html.includes('habitAnalyticsRange'), 'Analytics range control missing.');

assert(css.includes('UX Refinement — Habits command center'), 'Habit UX refinement styles missing.');
assert(css.includes('grid-template-columns: repeat(3, minmax(0, 1fr))'), 'Desktop habit cards should use a three-column layout.');
assert(css.includes('habit-chart-wrap'), 'Habit chart layout styling missing.');
assert(css.includes('min-height: 44px'), 'Habit touch targets must remain at least 44px.');
assert(css.includes('@media (max-width: 768px)'), 'Mobile habit breakpoint missing.');

assert(habitDomain.includes('function getHabitStreak'), 'Habit streak engine missing.');
assert(habitDomain.includes('function getHabitCompletionRate'), 'Habit completion engine missing.');
assert(habitDomain.includes('function getPortfolioAnalytics'), 'Habit portfolio analytics missing.');

assert(!/\bon(?:click|change|input|submit|keydown|keyup)\s*=/.test(html), 'Inline event handlers detected.');

console.log('Phase 9 UX + Habit refinement assertions passed.');
