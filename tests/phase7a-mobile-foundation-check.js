
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'css', 'app.css'), 'utf8');

const headSource = html.split('<body', 1)[0];
const viewportMatches = headSource.match(/<meta[^>]+name=["']viewport["'][^>]*>/gi) || [];
assert.strictEqual(viewportMatches.length, 1, 'Application entrypoint head must have exactly one viewport meta tag.');
assert(/width=device-width/i.test(viewportMatches[0]), 'Viewport must use device width.');

assert(css.includes('@media (max-width: 768px)'), 'Mobile breakpoint missing.');
assert(css.includes('min-height: 44px'), 'Touch target baseline missing.');
assert(css.includes('font-size: 16px'), 'Mobile input font-size protection missing.');
assert(css.includes('env(safe-area-inset-top'), 'Safe-area support missing.');
assert(css.includes('.mobile-txn-card'), 'Mobile transaction card contract missing.');
assert(css.includes('.mobile-txn-actions'), 'Mobile transaction action layout missing.');
assert(css.includes('.mobile-txn-actions .action-btn'), 'Mobile transaction action target missing.');
assert(css.includes('overflow-x: hidden'), 'Mobile horizontal overflow guard missing.');
assert(css.includes('overscroll-behavior: contain'), 'Modal/mobile scroll containment missing.');

const htmlHasSharedTxnContract =
  html.includes('buildTransactionViewModel') &&
  html.includes('renderTransactionActions(txn)');
assert(htmlHasSharedTxnContract, 'Desktop/mobile transaction rendering must share the existing data/action contract.');

console.log('Phase 7A Mobile Foundation assertions passed.');
