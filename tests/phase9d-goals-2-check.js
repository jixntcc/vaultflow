'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'css', 'app.css'), 'utf8');
const engine = fs.readFileSync(path.join(root, 'services', 'phase4-intelligence.js'), 'utf8');

assert(html.includes('id="goalsPlanningSummary"'), 'Goals planning summary missing.');
assert(html.includes('function renderGoalsPlanningSummary(projections)'), 'Goals planning renderer missing.');
assert(html.includes('function buildGoalViewModel(goal)'), 'Existing goal view model must remain.');
assert(html.includes('recommendedMonthlyContribution'), 'Recommended contribution missing from goal view model.');
assert(html.includes('deadlineFeasible'), 'Deadline feasibility missing from goal view model.');
assert(html.includes('data-goal-action="open"'), 'Goal open action contract missing.');
assert(html.includes('data-goal-action="edit"'), 'Goal edit action contract missing.');
assert(html.includes('data-goal-action="delete"'), 'Goal delete action contract missing.');

assert(engine.includes('recommendedMonthlyContribution'), 'Backend recommended contribution missing.');
assert(engine.includes('conservativeCompletionDate'), 'Backend conservative projection missing.');
assert(engine.includes('monthlySurplus'), 'Backend goal cash-flow capacity missing.');
assert(engine.includes('deadlineFeasible'), 'Backend deadline feasibility missing.');
assert(engine.includes('deadlineBufferMonths'), 'Backend deadline buffer missing.');
assert(engine.includes('calculateGoalProjections'), 'Goal projection engine missing.');

assert(css.includes('Phase 9D — Goals 2.0'), 'Phase 9D CSS missing.');
assert(css.includes('goals-planning-metrics'), 'Goal planning metrics styling missing.');
assert(css.includes('@media (max-width: 768px)'), 'Mobile goals planning breakpoint missing.');
assert(css.includes('min-height: 44px'), 'Mobile goal planning actions need touch-friendly targets.');

assert(!html.match(/\bon(?:click|change|input|submit|keydown|keyup)\s*=/i), 'Inline event handlers returned.');
console.log('Phase 9D Goals 2.0 assertions passed.');
