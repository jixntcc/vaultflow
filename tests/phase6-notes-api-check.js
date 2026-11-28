'use strict';
const assert = require('assert');
const notes = require('../api/notes');

assert.strictEqual(notes.routeOf('/api/notes'), 'collection');
assert.deepStrictEqual(notes.routeOf('/api/notes/0123456789abcdef01234567'), { id: '0123456789abcdef01234567' });
assert.strictEqual(notes.routeOf('/api/notes/not-an-id'), null);
assert.strictEqual(notes.normalizeText('  My note  ', 'title', 160, true), 'My note');
assert.throws(() => notes.normalizeText('   ', 'title', 160, true), e => e.status === 400);
assert.throws(() => notes.normalizeText('x'.repeat(161), 'title', 160, true), e => e.status === 400);
assert.deepStrictEqual(notes.normalizeTags([' Tax ', 'tax', 'Home']), ['tax', 'home']);
assert.throws(() => notes.normalizeTags('not-array'), e => e.status === 400);
assert.deepStrictEqual(notes.normalizeAttachmentIds(['0123456789abcdef01234567']), ['0123456789abcdef01234567']);
assert.throws(() => notes.normalizeAttachmentIds(['bad-id']), e => e.status === 400);
assert.strictEqual(notes.MAX_CONTENT_LENGTH, 100000);
assert.strictEqual(notes.MAX_ATTACHMENTS, 20);

const fs = require('fs');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, '..', 'api', 'notes.js'), 'utf8');
for (const required of [
  "userId: user._id",
  "status: 'available'",
  "Note.createIndexes()",
  "status: 'trashed'",
  "MAX_ATTACHMENTS"
]) assert.ok(source.includes(required), 'Missing notes security contract: ' + required);
const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
assert.ok(vercel.routes.some(item => item.src === '/api/notes(?:/.*)?' && item.dest === '/api/notes.js'));
console.log('VaultFlow OS4.1E Notes API contract checks: PASS');
