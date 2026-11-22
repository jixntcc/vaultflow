/**
 * VaultFlow Personal OS — ActivityItem contract (OS1).
 * Presentation contract only; source records remain in their own collections.
 */
'use strict';
const ACTIVITY_TYPES = Object.freeze(['transaction', 'habit', 'memory', 'note', 'portfolio']);
const ACTIVITY_MODULES = Object.freeze(['transactions', 'habits', 'memories', 'notes', 'portfolio']);
function cleanText(value, maxLength = 2000) {
  if (value === undefined || value === null) return null;
  return String(value).trim().slice(0, maxLength) || null;
}
function createActivityItem(input = {}) {
  const type = String(input.type || '');
  const module = String(input.source?.module || '');
  if (!ACTIVITY_TYPES.includes(type)) throw new TypeError('Unsupported ActivityItem type');
  if (!ACTIVITY_MODULES.includes(module)) throw new TypeError('Unsupported ActivityItem source module');
  if (!input.source?.recordId) throw new TypeError('ActivityItem source.recordId is required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.date || ''))) {
    throw new TypeError('ActivityItem date must use YYYY-MM-DD');
  }
  const amount = input.amount === undefined || input.amount === null ? null : Number(input.amount);
  if (amount !== null && !Number.isFinite(amount)) throw new TypeError('ActivityItem amount must be finite');
  return Object.freeze({
    id: module + ':' + String(input.source.recordId),
    type,
    category: cleanText(input.category, 80),
    title: cleanText(input.title, 200) || 'Untitled activity',
    description: cleanText(input.description, 2000),
    date: String(input.date),
    time: cleanText(input.time, 20),
    amount,
    currency: cleanText(input.currency, 12)?.toUpperCase() || null,
    source: Object.freeze({ module, recordId: String(input.source.recordId) }),
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {}
  });
}
module.exports = { ACTIVITY_TYPES, ACTIVITY_MODULES, createActivityItem };
