
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

assert(server.includes("app.get('/api/account/plan', ensureConnection, authenticateToken, async (req, res) => {"),
  'Account plan route must use the existing DB + JWT authentication middleware.');

assert(!server.includes("app.get('/api/account/plan', requireAuth"),
  'Undefined requireAuth middleware must not be referenced.');

const requireAuthOccurrences = (server.match(/\brequireAuth\b/g) || []).length;
assert.strictEqual(requireAuthOccurrences, 0,
  'requireAuth should not exist in this project unless explicitly defined/imported.');

console.log('Phase 6 account-plan authentication assertions passed.');
