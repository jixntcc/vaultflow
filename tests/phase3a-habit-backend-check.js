const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

for (const token of [
  'const habitSchema = new mongoose.Schema',
  'const Habit = mongoose.model',
  'const habitLogSchema = new mongoose.Schema',
  'const HabitLog = mongoose.model',
  "habitSchema.index({ userId: 1, status: 1, createdAt: -1 })",
  "habitLogSchema.index({ userId: 1, habitId: 1, scheduledDate: 1 }, { unique: true })",
  'function isValidLocalDate',
  'function normalizeHabitPayload',
  "app.get('/api/habits'",
  "app.post('/api/habits'",
  "app.put('/api/habits/:id'",
  "app.delete('/api/habits/:id'",
  "app.get('/api/habits/:id/logs'",
  "app.post('/api/habits/:id/logs'",
  "app.put('/api/habit-logs/:id'",
  "app.delete('/api/habit-logs/:id'",
  "app.get('/api/habits/summary'",
  "authenticateToken"
]) assert.ok(server.includes(token), `Missing: ${token}`);

assert.ok(server.includes("enum: ['daily', 'weekly']"));
assert.ok(server.includes("enum: ['active', 'paused', 'archived']"));
assert.ok(server.includes("enum: ['completed', 'skipped', 'missed']"));
assert.ok(server.includes("status must be completed or skipped"));
assert.ok(server.includes("scheduledDate cannot be before the habit startDate"));
assert.ok(server.includes("scheduledDate cannot be after the habit endDate"));
assert.ok(server.includes("status: 'archived'"));

console.log('VaultFlow Phase 3A static backend assertions passed.');
