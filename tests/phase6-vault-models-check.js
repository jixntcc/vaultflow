'use strict';

const assert = require('assert');
const mongoose = require('mongoose');

const VaultFolder = require('../models/vault-folder');
const VaultFile = require('../models/vault-file');
const VaultUsage = require('../models/vault-usage');
const Note = require('../models/note');

const ownerId = new mongoose.Types.ObjectId();

async function main() {
  assert.strictEqual(VaultFolder.modelName, 'VaultFolder');
  assert.strictEqual(VaultFile.modelName, 'VaultFile');
  assert.strictEqual(VaultUsage.modelName, 'VaultUsage');
  assert.strictEqual(Note.modelName, 'Note');

  const usage = new VaultUsage({ userId: ownerId });
  assert.strictEqual(usage.quotaBytes, 2147483648);
  assert.strictEqual(usage.usedBytes, 0);
  assert.strictEqual(usage.reservedBytes, 0);
  assert.strictEqual(usage.plan, 'free');
  await usage.validate();

  const folder = new VaultFolder({
    userId: ownerId,
    name: '  Receipts  '
  });
  await folder.validate();
  assert.strictEqual(folder.name, 'Receipts');
  assert.strictEqual(folder.normalizedName, 'receipts');
  assert.strictEqual(folder.parentId, null);

  const file = new VaultFile({
    userId: ownerId,
    objectKey: 'users/random-id/object',
    originalName: 'receipt.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024
  });
  assert.strictEqual(file.status, 'pending_upload');
  assert.strictEqual(file.encryptionMode, 'provider_managed');
  await file.validate();

  const note = new Note({
    userId: ownerId,
    title: '  Personal note  ',
    content: 'A note'
  });
  await note.validate();
  assert.strictEqual(note.title, 'Personal note');
  assert.strictEqual(note.status, 'active');
  assert.strictEqual(note.encryptionMode, 'provider_managed');

  const invalidFile = new VaultFile({
    userId: ownerId,
    objectKey: 'users/random-id/bad',
    originalName: '../secret.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 10
  });
  assert.ok(invalidFile.validateSync(), 'Path-like original filename must be rejected');

  const folderUniqueIndex = VaultFolder.schema.indexes().find(
    ([keys, options]) => options.name === 'uniq_vault_folder_name_per_parent'
  );
  assert.ok(folderUniqueIndex, 'Folder sibling uniqueness index must exist');
  assert.strictEqual(folderUniqueIndex[1].unique, true);

  const objectKeyIndex = VaultFile.schema.indexes().find(
    ([keys, options]) => options.name === 'uniq_vault_file_object_key'
  );
  assert.ok(objectKeyIndex, 'R2 object key uniqueness index must exist');
  assert.strictEqual(objectKeyIndex[1].unique, true);

  console.log('VaultFlow OS4.1B model contract checks: PASS');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
