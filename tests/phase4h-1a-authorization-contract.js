'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { assertOwnedResource } = require('../services/authorization-contract');

const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

async function testOwnedResourceHelper() {
  const userId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  const resourceId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
  let capturedFilter = null;

  const fakeModel = {
    base: { Types: { ObjectId: { isValid: value => /^[a-f0-9]{24}$/i.test(String(value)) } } },
    findOne(filter) {
      capturedFilter = filter;
      return {
        select() { return this; },
        lean: async () => ({ _id: resourceId, userId })
      };
    }
  };

  const resource = await assertOwnedResource(fakeModel, userId, resourceId, { select: '_id userId' });
  assert(resource);
  assert.strictEqual(String(capturedFilter._id), String(resourceId));
  assert.strictEqual(String(capturedFilter.userId), String(userId));

  await assert.rejects(
    () => assertOwnedResource(fakeModel, userId, 'not-an-object-id'),
    error => error.statusCode === 404 && error.code === 'RESOURCE_NOT_FOUND'
  );

  const missingModel = {
    base: { Types: { ObjectId: { isValid: value => /^[a-f0-9]{24}$/i.test(String(value)) } } },
    findOne(filter) {
      capturedFilter = filter;
      return {
        select() { return this; },
        lean: async () => null
      };
    }
  };
  await assert.rejects(
    () => assertOwnedResource(missingModel, userId, resourceId),
    error => error.statusCode === 404
  );
}

function assertContract(pattern, label) {
  assert(pattern.test(server), `Missing authorization contract: ${label}`);
}

(async () => {
  await testOwnedResourceHelper();

  // Every primary domain collection query must be scoped to the authenticated user.
  assertContract(/Transaction\.find\(\{ userId: req\.user\.userId \}\)/, 'transaction list ownership');
  assertContract(/Vault\.find\(\{ userId: req\.user\.userId \}\)/, 'vault list ownership');
  assertContract(/Goal\.find\(\{ userId: req\.user\.userId \}\)/, 'goal list ownership');
  assertContract(/Habit\.find\(\{ userId: req\.user\.userId \}\)/, 'habit list ownership');
  assertContract(/const query = \{ userId: req\.user\.userId \};[\s\S]*HabitLog\.find\(query\)/, 'habit-log ownership');

  // Nested resources must validate their parent belongs to the current user.
  assertContract(/Habit\.findOne\(\{\s*_id:\s*mutation\.payload\?\.habitId,\s*userId:\s*req\.user\.userId\s*\}\)/, 'sync habit ownership');
  assertContract(/const ownedVault = await assertOwnedVault\(req\.user\.userId,\s*payload\.vaultId \|\| null,\s*session\)/, 'sync transaction vault ownership');

  // Push endpoints are credentials/resources and may not be reassigned across accounts.
  assertContract(/const existing=await PushSubscription\.findOne\(\{endpoint:sub\.endpoint\}\)\.lean\(\);/, 'push endpoint lookup');
  assertContract(/String\(existing\.userId\) !== String\(req\.user\.userId\)/, 'push cross-account rejection');
  assertContract(/PushSubscription\.findOneAndUpdate\(\s*\{endpoint:sub\.endpoint,userId:req\.user\.userId\}/s, 'push update ownership');

  // The central helper must always inject userId into the resource query.
  const helper = fs.readFileSync(path.join(root, 'services', 'authorization-contract.js'), 'utf8');
  assert(/_id: resourceId,/.test(helper), 'central helper must bind resource id');
  assert(/userId\n  \}/.test(helper), 'central helper must bind authenticated user id');

  console.log('Phase 4H-1A authorization contract assertions passed.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
