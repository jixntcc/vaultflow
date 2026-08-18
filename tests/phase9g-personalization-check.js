'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const service = fs.readFileSync(path.join(root, 'services', 'phase4-intelligence.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'css', 'app.css'), 'utf8');

assert(service.includes('function buildPersonalizationProfile('), 'Personalization engine missing.');
assert(service.includes('confidence'), 'Personalization confidence missing.');
assert(service.includes('reasons'), 'Personalization reason model missing.');
assert(service.includes('secondaryFocus'), 'Secondary focus missing.');
assert(service.includes('adaptive:'), 'Adaptive experience model missing.');
assert(service.includes('healthScore'), 'Financial health must influence personalization.');
assert(service.includes('expenseGrowth'), 'Expense trend must influence personalization.');
assert(service.includes('activeGoals'), 'Goal state must influence personalization.');
assert(service.includes('habitRate'), 'Habit completion must influence personalization.');
assert(service.includes('observedDays'), 'Habit-finance observation quality must influence personalization.');
assert(service.includes('spendingDifference'), 'Habit-finance behavioral signal must influence personalization.');
assert(service.includes('dataQuality:'), 'Personalization data-quality metadata missing.');

assert(html.includes('id="dashboardPersonalizedFocus"'), 'Dashboard personalized focus missing.');
assert(html.includes('id="personalizationProfile"'), 'Personalization profile missing.');
assert(html.includes('p.confidence'), 'Personalization confidence not rendered.');
assert(html.includes('p.reasons'), 'Personalization reasons not rendered.');
assert(html.includes('Why this is your focus'), 'Personalization explanation UI missing.');
assert(html.includes('data-vf-action="switch-page"'), 'Personalization must use shared navigation contract.');

assert(css.includes('Phase 9G — Personalization'), 'Phase 9G CSS missing.');
assert(css.includes('personalization-confidence'), 'Personalization confidence styling missing.');
assert(css.includes('personalization-reasons'), 'Personalization reason styling missing.');
assert(css.includes('@media (max-width: 768px)'), 'Mobile personalization breakpoint missing.');
assert(css.includes('min-height: 44px'), 'Mobile personalization action needs touch-friendly sizing.');

assert(!html.match(/\bon(?:click|change|input|submit|keydown|keyup)\s*=/i), 'Inline event handlers returned.');
console.log('Phase 9G Personalization assertions passed.');
