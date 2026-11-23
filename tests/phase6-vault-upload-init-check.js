'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const vaultHandler = require('../api/vault');
const r2 = require('../lib/storage/r2');

const MAX_FILE_BYTES = 100 * 1024 * 1024;

function expectStatus(fn, status, message) {
  assert.throws(fn, error => error.status === status, message);
}

function main() {
  assert.strictEqual(vaultHandler.MAX_FILE_BYTES, MAX_FILE_BYTES);
  assert.strictEqual(vaultHandler.UPLOAD_URL_TTL_SECONDS, 300);
  assert.strictEqual(typeof r2.createPresignedPutUrl, 'function');

  const valid = vaultHandler.normalizeUploadRequest({
    originalName: 'receipt.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024
  });
  assert.strictEqual(valid.originalName, 'receipt.pdf');
  assert.strictEqual(valid.category, 'document');
  assert.strictEqual(valid.extension, 'pdf');
  assert.strictEqual(valid.folderId, null);

  const maxFile = vaultHandler.normalizeUploadRequest({
    originalName: 'large.pdf',
    mimeType: 'application/pdf',
    sizeBytes: MAX_FILE_BYTES
  });
  assert.strictEqual(maxFile.sizeBytes, MAX_FILE_BYTES);

  expectStatus(() => vaultHandler.normalizeUploadRequest({
    originalName: 'too-large.pdf',
    mimeType: 'application/pdf',
    sizeBytes: MAX_FILE_BYTES + 1
  }), 413, 'Files larger than 100 MiB must be rejected');

  expectStatus(() => vaultHandler.normalizeUploadRequest({
    originalName: '../secret.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 10
  }), 400, 'Path-like filenames must be rejected');

  expectStatus(() => vaultHandler.normalizeUploadRequest({
    originalName: 'script.exe',
    mimeType: 'application/x-msdownload',
    sizeBytes: 10
  }), 415, 'Unsupported MIME types must be rejected');

  expectStatus(() => vaultHandler.normalizeUploadRequest({
    originalName: 'bad.pdf',
    mimeType: 'application/pdf',
    sizeBytes: '1024'
  }), 400, 'String sizes must be rejected');

  const folderId = new mongoose.Types.ObjectId().toString();
  assert.strictEqual(vaultHandler.normalizeUploadRequest({
    originalName: 'scan.png',
    mimeType: 'image/png',
    sizeBytes: 2048,
    folderId
  }).folderId, folderId);

  expectStatus(() => vaultHandler.normalizeUploadRequest({
    originalName: 'scan.png',
    mimeType: 'image/png',
    sizeBytes: 2048,
    folderId: 'not-an-object-id'
  }), 400, 'Invalid folder IDs must be rejected');

  const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  assert.ok(vercel.builds.some(item => item.src === 'api/vault.js'));
  assert.ok(vercel.routes.some(item => item.src === '/api/vault(?:/.*)?' && item.dest === '/api/vault.js'));

  const apiSource = fs.readFileSync(path.join(__dirname, '..', 'api', 'vault.js'), 'utf8');
  assert.match(apiSource, /\$inc:\s*\{\s*reservedBytes:\s*sizeBytes\s*\}/);
  assert.match(apiSource, /\$expr:/);
  assert.match(apiSource, /sessionVersion/);
  assert.match(apiSource, /userId:\s*user\.\_id/);

  console.log('VaultFlow OS4.2 upload initialization contract checks: PASS');
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
