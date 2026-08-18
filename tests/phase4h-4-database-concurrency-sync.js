
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

function must(pattern, label) {
  assert(pattern.test(server), `Missing database/concurrency hardening: ${label}`);
}

// Critical ownership/query indexes.
must(/transactionSchema\.index\(\{ userId: 1, date: -1 \}\)/, 'transaction user/date index');
must(/transactionSchema\.index\(\{ userId: 1, vaultId: 1 \}\)/, 'transaction user/vault index');
must(/goalSchema\.index\(\{ userId: 1, status: 1, deadline: 1 \}\)/, 'goal projection index');
must(/goalSchema\.index\(\{ userId: 1, vaultId: 1 \}\)/, 'goal/vault index');
must(/habitLogSchema\.index\(\{ userId: 1, habitId: 1, scheduledDate: 1 \}, \{ unique: true \}\)/, 'habit log idempotency index');
must(/mutationReceiptSchema\.index\(\{ userId: 1, key: 1 \}, \{ unique: true \}\)/, 'sync receipt unique index');
must(/automationTriggerSchema\.index\(\{ ruleId: 1, key: 1 \}, \{ unique: true \}\)/, 'automation trigger unique index');

// Sync mutations and receipts must share one DB transaction.
must(/await runFinancialMutation\(async \(session\) => \{[\s\S]*claimMutationReceipt\(req\.user\.userId, key, type, session\)/s, 'sync receipt transaction');
must(/Transaction\.create\(\[\{[\s\S]*\}\], \{ session \}\)/s, 'sync transaction write uses session');
must(/rebuildVaultBalances\(req\.user\.userId, session\)/, 'sync vault rebuild uses same session');
must(/completeMutationReceipt\(req\.user\.userId, key, result, session\)/, 'sync receipt completion uses same session');

// A processing lease prevents concurrent duplicate execution and permits recovery.
must(/status: \{ type: String, enum: \['processing', 'completed'\]/, 'sync receipt processing state');
must(/processingUntil: \{ type: Date/, 'sync receipt lease');
must(/Mutation is already being processed/, 'concurrent sync rejection');

// Habit log uniqueness remains a DB-level last line of defense.
must(/HabitLog\.findOneAndUpdate\([\s\S]*upsert: true[\s\S]*session/s, 'atomic habit-log upsert');

// Automation duplicate prevention is DB-backed, not only lastTriggeredAt.
must(/async function claimAutomationTrigger\(rule, key, now = new Date\(\)\)/, 'automation trigger claim');
must(/AutomationTrigger\.create\(/, 'atomic automation claim insert');
must(/AutomationTrigger\.findOneAndUpdate\(/, 'automation lease reclaim');
must(/status: 'sent'/, 'automation sent state');
must(/completeAutomationTrigger\(claim\.trigger\._id\)/, 'automation completion');
must(/failAutomationTrigger\(claim\.trigger\._id, deliveryError\)/, 'automation failure state');

// Financial aggregate writes are transactional with snapshot/majority semantics.
must(/readConcern: \{ level: 'snapshot' \}/, 'snapshot read concern');
must(/writeConcern: \{ w: 'majority' \}/, 'majority write concern');
must(/maxCommitTimeMS: 10000/, 'bounded transaction commit time');

// Ownership filters remain attached to aggregate rebuilds.
must(/Vault\.updateOne\(\s*\{ _id: vault\._id, userId \}/s, 'vault rebuild ownership filter');

console.log('Phase 4H-4 database/concurrency/sync assertions passed.');
