'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vaultHandler = require('../api/vault');
const r2 = require('../lib/storage/r2');

function expectStatus(fn, status) {
  assert.throws(fn, error => error.status === status);
}

function main() {
  assert.strictEqual(vaultHandler.MAX_LIST_LIMIT, 100);
  assert.strictEqual(vaultHandler.normalizeFolderName('  Receipts  '), 'Receipts');
  expectStatus(() => vaultHandler.normalizeFolderName(''), 400);
  expectStatus(() => vaultHandler.normalizeFolderName('../private'), 400);
  expectStatus(() => vaultHandler.normalizeFolderName('folder\\name'), 400);
  expectStatus(() => vaultHandler.normalizeFolderName('x'.repeat(81)), 400);
  expectStatus(() => vaultHandler.parseOwnedParentId('not-an-object-id'), 400);
  assert.strictEqual(vaultHandler.parseOwnedParentId(null), null);

  assert.strictEqual(vaultHandler.getManagerRoute('/api/vault/files'), 'files');
  assert.strictEqual(vaultHandler.getManagerRoute('/api/vault/folders'), 'folders');
  assert.strictEqual(vaultHandler.getManagerRoute('/api/vault/usage'), 'usage');
  assert.deepStrictEqual(
    vaultHandler.getManagerRoute('/api/vault/files/0123456789abcdef01234567/download'),
    { type: 'download', id: '0123456789abcdef01234567' }
  );
  assert.deepStrictEqual(
    vaultHandler.getManagerRoute('/api/vault/folders/0123456789abcdef01234567'),
    { type: 'folder', id: '0123456789abcdef01234567' }
  );
  assert.strictEqual(vaultHandler.getManagerRoute('/api/vault/files/not-an-id/download'), null);

  assert.strictEqual(typeof r2.createPresignedGetUrl, 'function');

  const apiSource = fs.readFileSync(path.join(__dirname, '..', 'api', 'vault.js'), 'utf8');
  for (const required of [
    "status: 'available'",
    "status: 'quarantined'",
    "userId: user._id",
    "VaultFolder.createIndexes()",
    "createPresignedGetUrl({ key: file.objectKey, expiresIn: 60 })",
    ".select('_id folderId originalName mimeType extension sizeBytes category tags status createdAt updatedAt')",
    "res.setHeader('Allow', 'GET, POST')"
  ]) {
    assert.ok(apiSource.includes(required), 'Missing file manager security contract: ' + required);
  }
  assert.ok(!apiSource.includes(".select('_id objectKey uploadObjectKey"));
  const r2Source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'storage', 'r2.js'), 'utf8');
  assert.match(r2Source, /ResponseContentDisposition:\s*'attachment'/);
  assert.match(r2Source, /expiresIn < 1 \|\| expiresIn > 300/);

  const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  assert.ok(vercel.routes.some(item => item.src === '/api/vault(?:/.*)?' && item.dest === '/api/vault.js'));

  console.log('VaultFlow OS4.1D-2 file manager API contract checks: PASS');
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
