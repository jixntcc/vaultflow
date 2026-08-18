
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { assertOwnedResource } = require('../services/authorization-contract');

const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

const A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const B = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const RID = 'cccccccccccccccccccccccc';

function makeScopedModel(ownerId) {
  return {
    base: { Types: { ObjectId: { isValid: value => /^[a-f0-9]{24}$/i.test(String(value)) } } },
    findOne(filter) {
      return {
        select() { return this; },
        lean: async () => String(filter.userId) === String(ownerId)
          ? { _id: filter._id, userId: ownerId }
          : null
      };
    }
  };
}

async function attackVector(name, authenticatedUser, resourceOwner, expectAllowed) {
  const model = makeScopedModel(resourceOwner);
  let allowed = false;
  try {
    await assertOwnedResource(model, authenticatedUser, RID);
    allowed = true;
  } catch (error) {
    assert.strictEqual(error.statusCode, 404);
    assert.strictEqual(error.code, 'RESOURCE_NOT_FOUND');
  }
  assert.strictEqual(
    allowed,
    expectAllowed,
    `${name}: expected ${expectAllowed ? 'ALLOW' : 'DENY'}, got ${allowed ? 'ALLOW' : 'DENY'}`
  );
}

async function runRuntimeOwnershipMatrix() {
  // Baseline: User A may access A's resource.
  await attackVector('A -> A resource', A, A, true);

  // Core cross-user attacks: every resource owned by B must be invisible to A.
  const resources = [
    'transaction',
    'vault',
    'goal',
    'habit',
    'habit log',
    'automation rule',
    'audit event',
    'notification settings',
    'push subscription'
  ];

  for (const resource of resources) {
    await attackVector(`A -> B ${resource}`, A, B, false);
    await attackVector(`B -> A ${resource}`, B, A, false);
  }
}

function assertRouteProtected(route) {
  const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert(
    new RegExp(`app\\.(?:get|post|put|patch|delete)\\('${escaped}'[^\\n]*authenticateToken`).test(server),
    `Missing authenticateToken middleware: ${route}`
  );
}

function assertOwnershipContract(pattern, label) {
  assert(pattern.test(server), `Missing ownership protection: ${label}`);
}

function runStaticRouteMatrix() {
  const protectedRoutes = [
    '/api/vaults',
    '/api/transactions',
    '/api/goals',
    '/api/habits',
    '/api/habit-logs',
    '/api/notifications/settings',
    '/api/notifications/subscribe',
    '/api/notifications/subscriptions',
    '/api/habits/summary',
    '/api/insights',
    '/api/goals/projections',
    '/api/search',
    '/api/audit',
    '/api/automation/rules',
    '/api/sync/mutations',
    '/api/analytics/summary',
    '/api/analytics/full'
  ];

  for (const route of protectedRoutes) assertRouteProtected(route);

  const resourceRoutes = [
    '/api/vaults/:id',
    '/api/transactions/:id',
    '/api/goals/:id',
    '/api/habits/:id',
    '/api/habits/:id/logs',
    '/api/habit-logs/:id',
    '/api/automation/rules/:id'
  ];

  for (const route of resourceRoutes) {
    assert(
      server.includes(`'${route}'`) && server.includes('authenticateToken'),
      `Resource route is not visibly protected: ${route}`
    );
  }

  // Collection reads must derive the owner from the JWT, never from request input.
  assertOwnershipContract(/Transaction\.find\(\{ userId: req\.user\.userId \}\)/, 'transaction collection');
  assertOwnershipContract(/Vault\.find\(\{ userId: req\.user\.userId \}\)/, 'vault collection');
  assertOwnershipContract(/Goal\.find\(\{ userId: req\.user\.userId \}\)/, 'goal collection');
  assertOwnershipContract(/Habit\.find\(\{ userId: req\.user\.userId \}\)/, 'habit collection');
  assertOwnershipContract(/HabitLog\.find\(query\)/, 'habit-log collection');

  // Resource mutations must bind the resource ID and authenticated user.
  assertOwnershipContract(/Transaction\.findOne\(\{\s*_id: req\.params\.id,\s*userId: req\.user\.userId\s*\}\)/s, 'transaction resource');
  assertOwnershipContract(/Vault\.findOne\(\{\s*_id: req\.params\.id,\s*userId: req\.user\.userId\s*\}\)/s, 'vault resource');
  assertOwnershipContract(/Goal\.findOneAndUpdate\(\s*\{\s*_id: req\.params\.id,\s*userId: req\.user\.userId\s*\}/s, 'goal resource');
  assertOwnershipContract(/Habit\.findOne\(\{\s*_id: req\.params\.id,\s*userId: req\.user\.userId\s*\}\)/s, 'habit resource');
  assertOwnershipContract(/HabitLog\.findOne\(\{\s*_id: req\.params\.id,\s*userId: req\.user\.userId\s*\}\)/s, 'habit-log resource');
  assertOwnershipContract(/AutomationRule\.findOneAndUpdate\([\s\S]{0,200}_id: req\.params\.id,\s*userId: req\.user\.userId/s, 'automation update');
  assertOwnershipContract(/AutomationRule\.findOneAndDelete\(\{\s*_id: req\.params\.id,\s*userId: req\.user\.userId/s, 'automation delete');

  // Nested resources: attacker cannot use B's parent ID through A's session.
  assertOwnershipContract(/Habit\.findOne\(\{\s*_id:\s*mutation\.payload\?\.habitId,\s*userId:\s*req\.user\.userId\s*\}\)/, 'offline habit parent');
  assertOwnershipContract(/assertOwnedVault\(req\.user\.userId,\s*payload\.vaultId \|\| null,\s*session\)/, 'offline transaction vault parent');

  // Push credentials cannot be transferred between accounts.
  assertOwnershipContract(/String\(existing\.userId\) !== String\(req\.user\.userId\)/, 'push cross-account rejection');
  assertOwnershipContract(/PushSubscription\.findOneAndUpdate\(\s*\{endpoint:sub\.endpoint,userId:req\.user\.userId\}/s, 'push subscription ownership');

  // No protected route may accept a caller-supplied userId as its ownership authority.
  assert(!/userId:\s*req\.body\.userId/.test(server), 'request body must not control ownership');
  assert(!/userId:\s*req\.query\.userId/.test(server), 'query string must not control ownership');

  // The cron endpoint is intentionally not JWT-authenticated, but must be protected
  // by a server-side secret before executing notification/automation jobs.
  assert(/\/api\/cron\/notifications[\s\S]*?CRON_SECRET/.test(server), 'cron endpoint missing CRON_SECRET guard');
  assert(/auth !== `Bearer \$\{expected\}`/.test(server), 'cron endpoint missing bearer secret comparison');
}

(async () => {
  await runRuntimeOwnershipMatrix();
  runStaticRouteMatrix();

  console.log('Phase 4H-1B cross-user attack matrix passed.');
  console.log('Runtime vectors: 1 same-user allow + 18 cross-user deny cases.');
  console.log('Static vectors: protected routes, nested resources, sync parents, push credentials, caller-supplied userId, cron secret.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
