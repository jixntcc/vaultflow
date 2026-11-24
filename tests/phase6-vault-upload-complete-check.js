'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vaultHandler = require('../api/vault');
const r2 = require('../lib/storage/r2');

function main() {
  const id = '0123456789abcdef01234567';
  assert.strictEqual(vaultHandler.getCompletionFileId(`/api/vault/uploads/${id}/complete`), id);
  assert.strictEqual(vaultHandler.getCompletionFileId(`/api/vault/uploads/${id}/complete/`), id);
  assert.strictEqual(vaultHandler.getCompletionFileId('/api/vault/uploads/not-an-id/complete'), null);
  assert.strictEqual(vaultHandler.getCompletionFileId(`/api/vault/uploads/${id}/complete/extra`), null);

  for (const name of ['headR2Object', 'promoteR2Object', 'deleteR2Object']) {
    assert.strictEqual(typeof r2[name], 'function', `R2 helper ${name} must be exported`);
  }

  const modelSource = fs.readFileSync(path.join(__dirname, '..', 'models', 'vault-file.js'), 'utf8');
  assert.match(modelSource, /uploadObjectKey:[\s\S]*?immutable:\s*true/);
  assert.match(modelSource, /uniq_vault_file_upload_object_key/);

  const apiSource = fs.readFileSync(path.join(__dirname, '..', 'api', 'vault.js'), 'utf8');
  for (const required of [
    'headR2Object(file.uploadObjectKey)',
    'Number(sourceHead.ContentLength) !== file.sizeBytes',
    'sourceHead.ContentType',
    'sourceEtag: sourceHead.ETag',
    "status: 'quarantined'",
    'reservedBytes: { $gte: file.sizeBytes }',
    'reservedBytes: -file.sizeBytes, usedBytes: file.sizeBytes',
    'session.withTransaction',
    'deleteR2Object(file.uploadObjectKey)'
  ]) {
    assert.ok(apiSource.includes(required), `Missing completion contract: ${required}`);
  }

  console.log('VaultFlow OS4.3 upload completion contract checks: PASS');
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
