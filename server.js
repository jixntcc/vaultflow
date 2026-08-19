/**
* VaultFlow Financial Tracker - Backend Server (Vercel Optimized)
* Node.js + Express + MongoDB
*/

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const webpush = require('web-push');
const { calculateFinancialIntelligence, detectRecurringExpenses, calculateGoalProjections, calculateHabitSnapshot, buildInsights, searchAll } = require('./services/phase4-intelligence');
const { assertOwnedResource } = require('./services/authorization-contract');

require('dotenv').config();

const app = express();
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

const mailTransporter = nodemailer.createTransport({
service: 'gmail',
auth: {
user: EMAIL_USER,
pass: EMAIL_PASS
}
});
const AUTH_TOKEN_TTL = process.env.AUTH_TOKEN_TTL || '30d';
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@vaultflow.app';
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// Middleware
const configuredCorsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

if (configuredCorsOrigins.length > 0) {
  app.use(cors({
    origin(origin, callback) {
      if (!origin || configuredCorsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('CORS origin not allowed'));
    }
  }));
}

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html for all non-API routes
app.get('*', (req, res, next) => {
if (!req.path.startsWith('/api/')) {
res.sendFile(path.join(__dirname, 'public', 'index.html'));
} else {
next();
}
});

// ============================================
// MONGODB CONNECTION (VERCEL OPTIMIZED)
// ============================================

let cachedConnection = null;
let connectingPromise = null;

async function connectToDatabase() {
if (cachedConnection && mongoose.connection.readyState === 1) {
console.log('✅ Using cached MongoDB connection');
return cachedConnection;
}
if (connectingPromise) {
console.log('⏳ Awaiting in-flight MongoDB connection');
await connectingPromise;
if (mongoose.connection.readyState !== 1) {
throw new Error('MongoDB connection not ready after awaiting in-flight connect');
}
return cachedConnection || mongoose.connection;
}

try {
const opts = {
useNewUrlParser: true,
useUnifiedTopology: true,
serverSelectionTimeoutMS: 10000, // 10 second timeout
socketTimeoutMS: 45000, // 45 second timeout
maxPoolSize: 10,
minPoolSize: 2,
bufferCommands: false
};

console.log('🔄 Connecting to MongoDB...');
connectingPromise = mongoose.connect(process.env.MONGODB_URI, opts);
const conn = await connectingPromise;
cachedConnection = conn;
connectingPromise = null;
console.log('✅ MongoDB Connected');
if (mongoose.connection.readyState !== 1) {
throw new Error(`MongoDB readyState is ${mongoose.connection.readyState} after connect`);
}
return conn;
} catch (err) {
connectingPromise = null;
console.error('❌ MongoDB Connection Error:', err);
throw err;
}
}

// ============================================
// MODELS
// ============================================

// User Schema
const userSchema = new mongoose.Schema({
username: { type: String, required: true, unique: true },
email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
password: { type: String, required: true },
passwordResetTokenHash: { type: String },
passwordResetExpiresAt: { type: Date },
passwordResetTokenType: { type: String },
createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Vault Schema
const vaultSchema = new mongoose.Schema({
userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
name: { type: String, required: true },
percentage: { type: Number, required: true },
description: { type: String },
totalIncome: { type: Number, default: 0 },
totalSpent: { type: Number, default: 0 },
balance: { type: Number, default: 0 },
createdAt: { type: Date, default: Date.now }
});

const Vault = mongoose.model('Vault', vaultSchema);

// Transaction Schema
const transactionSchema = new mongoose.Schema({
userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
date: { type: Date, required: true },
time: { type: String },
type: { type: String, enum: ['income', 'expense'], required: true },
amount: { type: Number, required: true },
category: { type: String, required: true },
location: { type: String },
wallet: { type: String, enum: ['HR', 'HL'] },
paymentMethod: { type: String, enum: ['online', 'byhand'], default: 'online' },
vaultId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vault' },
vaultName: { type: String },
notes: { type: String },
createdAt: { type: Date, default: Date.now }
});

transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, vaultId: 1 });
const Transaction = mongoose.model('Transaction', transactionSchema);

// Goal Schema (FIXED)
const goalSchema = new mongoose.Schema({
userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
name: { type: String, required: true },
targetAmount: { type: Number, required: true },
currentAmount: { type: Number, default: 0 },
vaultId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vault' }, // Made optional
vaultName: { type: String },
deadline: { type: Date },
status: { type: String, enum: ['active', 'completed', 'archived'], default: 'active' },
notes: { type: String },
createdAt: { type: Date, default: Date.now }
});

goalSchema.index({ userId: 1, status: 1, deadline: 1 });
const Goal = mongoose.model('Goal', goalSchema);

const habitSchema = new mongoose.Schema({
userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
name: { type: String, required: true, trim: true, maxlength: 120 },
description: { type: String, trim: true, maxlength: 1000 },
category: { type: String, trim: true, maxlength: 60 },
color: { type: String, trim: true, maxlength: 60 },
icon: { type: String, trim: true, maxlength: 60 },
frequency: {
type: {
type: String,
enum: ['daily', 'weekly'],
required: true
},
daysOfWeek: {
type: [{ type: Number, min: 0, max: 6 }],
default: []
},
targetPerWeek: {
type: Number,
min: 1,
max: 7
}
},
startDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
endDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
preferredTime: { type: String, match: /^(?:[01]\d|2[0-3]):[0-5]\d$/ },
reminder: {
enabled: { type: Boolean, default: false },
time: { type: String, match: /^(?:[01]\d|2[0-3]):[0-5]\d$/ }
},
status: {
type: String,
enum: ['active', 'paused', 'archived'],
default: 'active'
},
createdAt: { type: Date, default: Date.now },
updatedAt: { type: Date, default: Date.now }
}, { versionKey: false });

habitSchema.index({ userId: 1, status: 1, createdAt: -1 });

habitSchema.pre('validate', function(next) {
if (this.frequency?.type === 'daily') {
this.frequency.daysOfWeek = [];
this.frequency.targetPerWeek = undefined;
}
if (this.frequency?.type === 'weekly') {
const days = Array.isArray(this.frequency.daysOfWeek) ? [...new Set(this.frequency.daysOfWeek)] : [];
if (days.some(day => !Number.isInteger(day) || day < 0 || day > 6)) {
return next(new Error('daysOfWeek must contain integers from 0 to 6'));
}
this.frequency.daysOfWeek = days.sort((a, b) => a - b);
if (this.frequency.targetPerWeek == null) {
this.frequency.targetPerWeek = days.length || 1;
}
if (this.frequency.targetPerWeek < 1 || this.frequency.targetPerWeek > 7) {
return next(new Error('targetPerWeek must be between 1 and 7'));
}
if (days.length > 0 && this.frequency.targetPerWeek > days.length) {
return next(new Error('targetPerWeek cannot exceed the number of selected weekdays'));
}
}
if (this.startDate && this.endDate && this.endDate < this.startDate) {
return next(new Error('endDate cannot be before startDate'));
}
if (this.reminder?.enabled && !this.reminder.time) {
return next(new Error('reminder.time is required when reminders are enabled'));
}
next();
});

const Habit = mongoose.model('Habit', habitSchema);

const habitLogSchema = new mongoose.Schema({
userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
habitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Habit', required: true, index: true },
scheduledDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
status: {
type: String,
enum: ['completed', 'skipped', 'missed'],
required: true
},
completedAt: { type: Date },
note: { type: String, trim: true, maxlength: 500 },
createdAt: { type: Date, default: Date.now },
updatedAt: { type: Date, default: Date.now }
}, { versionKey: false });

habitLogSchema.index({ userId: 1, habitId: 1, scheduledDate: 1 }, { unique: true });
habitLogSchema.index({ userId: 1, scheduledDate: 1 });

habitLogSchema.pre('validate', function(next) {
if (this.status === 'completed' && !this.completedAt) {
this.completedAt = new Date();
}
if (this.status !== 'completed') {
this.completedAt = undefined;
}
next();
});

const HabitLog = mongoose.model('HabitLog', habitLogSchema);

// Web Push subscription: one record per browser/device subscription.
const pushSubscriptionSchema = new mongoose.Schema({
userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
endpoint: { type: String, required: true, unique: true },
p256dh: { type: String, required: true },
auth: { type: String, required: true },
timezone: { type: String, default: 'UTC' },
userAgent: { type: String, maxlength: 500 },
createdAt: { type: Date, default: Date.now },
updatedAt: { type: Date, default: Date.now },
lastSeenAt: { type: Date, default: Date.now }
}, { versionKey: false });
pushSubscriptionSchema.index({ userId: 1, updatedAt: -1 });
const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema);

const notificationSettingsSchema = new mongoose.Schema({
userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
enabled: { type: Boolean, default: false },
dailyReminder: { type: Boolean, default: true },
weeklySummary: { type: Boolean, default: true },
savingsInsights: { type: Boolean, default: true },
habitReminder: { type: Boolean, default: true },
habitWeeklySummary: { type: Boolean, default: true },
habitRisk: { type: Boolean, default: true },
updatedAt: { type: Date, default: Date.now }
}, { versionKey: false });
const NotificationSettings = mongoose.model('NotificationSettings', notificationSettingsSchema);

const notificationDeliverySchema = new mongoose.Schema({
userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'PushSubscription', required: true },
key: { type: String, required: true },
sentAt: { type: Date, default: Date.now },
status: { type: String, enum: ['sent', 'gone', 'failed'], default: 'sent' }
}, { versionKey: false });
notificationDeliverySchema.index({ userId: 1, subscriptionId: 1, key: 1 }, { unique: true });
notificationDeliverySchema.index({ sentAt: 1 });
const NotificationDelivery = mongoose.model('NotificationDelivery', notificationDeliverySchema);
// ============================================
// PHASE 4 PLATFORM MODELS
// ============================================
const auditEventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: { type: String, required: true, maxlength: 80 },
  resource: { type: String, required: true, maxlength: 80 },
  resourceId: { type: String, default: null, maxlength: 120 },
  method: { type: String, required: true, maxlength: 10 },
  path: { type: String, required: true, maxlength: 180 },
  success: { type: Boolean, default: true },
  statusCode: { type: Number, default: 200 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });
auditEventSchema.index({ userId: 1, createdAt: -1 });
const AuditEvent = mongoose.model('AuditEvent', auditEventSchema);

const automationRuleSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  event: { type: String, enum: ['goal_at_risk','expense_threshold','habit_streak','weekly_summary'], required: true },
  condition: { type: mongoose.Schema.Types.Mixed, default: {} },
  action: { type: String, enum: ['push','in_app'], default: 'push' },
  enabled: { type: Boolean, default: true },
  lastTriggeredAt: { type: Date, default: null }
}, { timestamps: true });
automationRuleSchema.index({ userId: 1, enabled: 1, event: 1 });
const AutomationRule = mongoose.model('AutomationRule', automationRuleSchema);

const mutationReceiptSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  key: { type: String, required: true, maxlength: 160 },
  type: { type: String, required: true, maxlength: 80 },
  result: { type: mongoose.Schema.Types.Mixed, default: null }
}, { timestamps: true });
mutationReceiptSchema.index({ userId: 1, key: 1 }, { unique: true });
const MutationReceipt = mongoose.model('MutationReceipt', mutationReceiptSchema);



// ============================================
// MIDDLEWARE
// ============================================

// Database connection middleware
const ensureConnection = async (req, res, next) => {
try {
await connectToDatabase();
if (mongoose.connection.readyState !== 1) {
throw new Error(`MongoDB connection not ready in middleware. readyState=${mongoose.connection.readyState}`);
}
next();
} catch (error) {
console.error('Database connection failed:', error);
return res.status(503).json({ error: 'Database connection failed' });
}
};

// Authentication Middleware
const authenticateToken = (req, res, next) => {
const authHeader = req.headers['authorization'];
const token = authHeader && authHeader.startsWith('Bearer ')
  ? authHeader.slice(7).trim()
  : null;

if (!token) {
return res.status(401).json({ error: 'Access token required' });
}
if (!process.env.JWT_SECRET) {
return res.status(500).json({ error: 'Server authentication is not configured' });
}

jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
if (err) {
return res.status(403).json({ error: 'Invalid or expired token' });
}
if (!user || !user.userId) {
return res.status(403).json({ error: 'Invalid token subject' });
}
req.user = user;
next();
});
};

const authMiddleware = authenticateToken;

function isValidLocalDate(value) {
if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
const [year, month, day] = value.split('-').map(Number);
const d = new Date(Date.UTC(year, month - 1, day));
return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}
function isValidTimeZone(value) {
if (typeof value !== 'string' || value.length < 1 || value.length > 100) return false;
try {
new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
return true;
} catch (_) {
return false;
}
}

function normalizeHabitPayload(body = {}, existing = null) {
const frequencyInput = body.frequency || existing?.frequency || {};
const type = frequencyInput.type;
const daysOfWeek = Array.isArray(frequencyInput.daysOfWeek)
? [...new Set(frequencyInput.daysOfWeek.map(Number))]
: [];
const targetPerWeek = frequencyInput.targetPerWeek == null
? undefined
: Number(frequencyInput.targetPerWeek);

const startDate = body.startDate ?? existing?.startDate;
const endDate = body.endDate ?? existing?.endDate;

if (!startDate || !isValidLocalDate(startDate)) {
return { error: 'startDate must be a valid YYYY-MM-DD date' };
}
if (endDate && (!isValidLocalDate(endDate) || endDate < startDate)) {
return { error: 'endDate must be a valid date on or after startDate' };
}
if (!['daily', 'weekly'].includes(type)) {
return { error: 'frequency.type must be daily or weekly' };
}
if (daysOfWeek.some(day => !Number.isInteger(day) || day < 0 || day > 6)) {
return { error: 'frequency.daysOfWeek must contain integers from 0 to 6' };
}
if (type === 'weekly') {
const effectiveTarget = targetPerWeek == null ? (daysOfWeek.length || 1) : targetPerWeek;
if (!Number.isInteger(effectiveTarget) || effectiveTarget < 1 || effectiveTarget > 7) {
return { error: 'frequency.targetPerWeek must be an integer from 1 to 7' };
}
if (daysOfWeek.length > 0 && effectiveTarget > daysOfWeek.length) {
return { error: 'frequency.targetPerWeek cannot exceed selected weekdays' };
}
} else if (daysOfWeek.length > 0 || targetPerWeek != null) {
return { error: 'daily habits cannot specify daysOfWeek or targetPerWeek' };
}

const reminder = body.reminder ?? existing?.reminder ?? { enabled: false };
if (reminder?.enabled && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(reminder.time || '')) {
return { error: 'reminder.time is required in HH:mm format when reminders are enabled' };
}

return {
value: {
name: String(body.name ?? existing?.name ?? '').trim(),
description: body.description ?? existing?.description ?? '',
category: body.category ?? existing?.category ?? '',
color: body.color ?? existing?.color ?? '',
icon: body.icon ?? existing?.icon ?? '',
frequency: {
type,
daysOfWeek: type === 'weekly' ? daysOfWeek.sort((a, b) => a - b) : [],
...(type === 'weekly'
? { targetPerWeek: targetPerWeek == null ? (daysOfWeek.length || 1) : targetPerWeek }
: {})
},
startDate,
endDate: endDate || undefined,
preferredTime: body.preferredTime ?? existing?.preferredTime ?? undefined,
reminder: {
enabled: Boolean(reminder?.enabled),
time: reminder?.enabled ? reminder.time : undefined
},
status: body.status ?? existing?.status ?? 'active'
}
};
}


// ============================================
// WEB PUSH + BACKGROUND NOTIFICATION ENGINE
// ============================================
function pushConfigured() {
return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}
function getTimeZoneParts(date, timeZone) {
try {
const parts = new Intl.DateTimeFormat('en-US', {
timeZone,
year: 'numeric', month: '2-digit', day: '2-digit',
hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short'
}).formatToParts(date).reduce((acc, part) => { acc[part.type] = part.value; return acc; }, {});
return { year: parts.year, month: parts.month, day: parts.day, hour: Number(parts.hour) % 24, minute: Number(parts.minute), weekday: parts.weekday };
} catch (_) {
const d = new Date(date);
return { year: String(d.getUTCFullYear()), month: String(d.getUTCMonth()+1).padStart(2,'0'), day: String(d.getUTCDate()).padStart(2,'0'), hour: d.getUTCHours(), minute: d.getUTCMinutes(), weekday: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()] };
}
}
function localDateFromParts(parts) { return `${parts.year}-${parts.month}-${parts.day}`; }
function isHabitScheduledOnServer(habit, date) {
const d = new Date(`${date}T12:00:00Z`);
if (Number.isNaN(d.getTime())) return false;
if (date < habit.startDate || (habit.endDate && date > habit.endDate)) return false;
if (habit.frequency?.type === 'daily') return true;
return Array.isArray(habit.frequency?.daysOfWeek) && habit.frequency.daysOfWeek.includes(d.getUTCDay());
}
function addDaysLocalDate(date, amount) {
const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+amount);
return d.toISOString().slice(0,10);
}
async function getHabitStatusForDate(habitId, date, logs) {
const log = logs.find(x => String(x.habitId) === String(habitId) && x.scheduledDate === date);
return log?.status || 'pending';
}
async function getCurrentHabitStreakServer(habit, today, logs) {
let cursor = today, streak = 0;
for (let i=0; i<366; i++) {
if (!isHabitScheduledOnServer(habit, cursor)) { cursor = addDaysLocalDate(cursor,-1); continue; }
const status = await getHabitStatusForDate(habit._id, cursor, logs);
if (status !== 'completed') break;
streak++; cursor = addDaysLocalDate(cursor,-1);
}
return streak;
}
async function claimDelivery(userId, subscriptionId, key) {
try { await NotificationDelivery.create({ userId, subscriptionId, key, status:'sent' }); return true; }
catch (error) { if (error?.code === 11000) return false; throw error; }
}
async function sendBackgroundPush(subscriptionDoc, payload, key) {
if (!pushConfigured()) return { skipped: true, reason: 'VAPID_NOT_CONFIGURED' };
const claimed = await claimDelivery(subscriptionDoc.userId, subscriptionDoc._id, key);
if (!claimed) return { skipped: true, reason: 'ALREADY_SENT' };
try {
await webpush.sendNotification({ endpoint: subscriptionDoc.endpoint, keys: { p256dh: subscriptionDoc.p256dh, auth: subscriptionDoc.auth } }, JSON.stringify(payload), { TTL: 3600, urgency: payload.data?.urgency || 'normal', topic: String(key).replace(/[^A-Za-z0-9_-]/g,'_').slice(0,32) });
return { sent: true };
} catch (error) {
const gone = error?.statusCode === 404 || error?.statusCode === 410;
await NotificationDelivery.updateOne({ userId: subscriptionDoc.userId, subscriptionId: subscriptionDoc._id, key }, { $set: { status: gone ? 'gone' : 'failed' } });
if (gone) await PushSubscription.deleteOne({ _id: subscriptionDoc._id });
return { sent: false, gone, error: error?.message || 'Push delivery failed' };
}
}

async function evaluateAutomationRules(now = new Date()) {
  const rules = await AutomationRule.find({ enabled: true }).lean();
  let triggered = 0;
  for (const rule of rules) {
    try {
      const snapshot = await getUserDomainSnapshot(rule.userId);
      const financial = calculateFinancialIntelligence(snapshot.transactions, now);
      const goals = calculateGoalProjections(snapshot.goals, snapshot.transactions, now);
      const habits = calculateHabitSnapshot(snapshot.habits, snapshot.habitLogs, now);
      let shouldTrigger = false;
      let title = rule.name;
      let body = 'A VaultFlow automation rule was triggered.';
      if (rule.event === 'goal_at_risk') {
        const goal = goals.find(g => g.status === 'at-risk');
        shouldTrigger = Boolean(goal);
        if (goal) { title = `Goal at risk: ${goal.name}`; body = `Your current pace may miss the ${goal.name} target.`; }
      } else if (rule.event === 'expense_threshold') {
        const threshold = Number(rule.condition?.threshold || 0);
        const today = now.toISOString().slice(0,10);
        const amount = snapshot.transactions.filter(t => t.type === 'expense' && String(t.date).slice(0,10) === today).reduce((a,t)=>a+Number(t.amount||0),0);
        shouldTrigger = threshold > 0 && amount >= threshold;
        if (shouldTrigger) { title = `${rule.name}`; body = `Today's expenses reached ${amount.toFixed(2)}.`; }
      } else if (rule.event === 'habit_streak') {
        const threshold = Math.max(1, Number(rule.condition?.threshold || 7));
        for (const habit of snapshot.habits.filter(h => h.status === 'active')) {
          const streak = await getCurrentHabitStreakServer(habit, now.toISOString().slice(0,10), snapshot.habitLogs);
          if (streak >= threshold) { shouldTrigger = true; title = `${habit.name}: ${streak} day streak`; body = `You reached the streak threshold of ${threshold} days.`; break; }
        }
      } else if (rule.event === 'weekly_summary') {
        shouldTrigger = now.getUTCDay() === 0 && now.getUTCHours() >= 18;
        body = `Savings rate ${financial.totals.savingsRate}%, habit completion ${habits.overallCompletionRate}%.`;
      }
      if (!shouldTrigger) continue;
      if (rule.lastTriggeredAt && (now - new Date(rule.lastTriggeredAt)) < 20 * 60 * 1000) continue;
      const subs = rule.action === 'push'
        ? await PushSubscription.find({ userId: rule.userId }).lean()
        : [];
      const key = `automation:${rule._id}:${now.toISOString().slice(0,13)}`;
      let delivered = rule.action === 'in_app';
      for (const sub of subs) {
        const result = await sendBackgroundPush(sub, { title, body, data:{ page:'insights', tag:key, urgency:'normal' } }, key);
        if (result.sent) delivered = true;
      }
      if (delivered) {
        await AutomationRule.updateOne({ _id: rule._id }, { $set: { lastTriggeredAt: now } });
        triggered++;
      }
    } catch (error) {
      console.error('[Automation] rule evaluation failed:', rule._id, error.message);
    }
  }
  return { triggered };
}

async function runBackgroundNotificationJob(now = new Date()) {
if (!pushConfigured()) return { configured:false, sent:0, skipped:'VAPID_NOT_CONFIGURED' };
const subscriptions = await PushSubscription.find({}).lean().maxTimeMS(15000);
let sent=0, checked=0;
for (const sub of subscriptions) {
checked++;
const parts=getTimeZoneParts(now, sub.timezone || 'UTC');
const today=localDateFromParts(parts);
const settings=await NotificationSettings.findOne({ userId: sub.userId }).lean();
if (!settings?.enabled) continue;
const habits=await Habit.find({ userId: sub.userId, status:'active', 'reminder.enabled':true }).lean();
const logs=await HabitLog.find({ userId: sub.userId, scheduledDate: { $gte:addDaysLocalDate(today,-370), $lte:today } }).lean();
for (const habit of habits) {
if (!settings.habitReminder || !habit.reminder?.enabled || !habit.reminder.time || !isHabitScheduledOnServer(habit,today)) continue;
const [hh,mm]=habit.reminder.time.split(':').map(Number);
if (parts.hour*60+parts.minute < hh*60+mm) continue;
if (await getHabitStatusForDate(habit._id,today,logs)==='completed') continue;
const key=`habit-reminder:${today}:${habit._id}`;
const result=await sendBackgroundPush(sub,{title:`Habit reminder: ${habit.name}`,body:'Your scheduled habit is still pending.',data:{page:'habits',habitId:String(habit._id),date:today,tag:key,urgency:'normal'}},key);
if(result.sent) sent++;
}
if (settings.habitRisk) {
for (const habit of habits) {
if (!isHabitScheduledOnServer(habit,today)) continue;
if (await getHabitStatusForDate(habit._id,today,logs)!=='pending') continue;
const streak=await getCurrentHabitStreakServer(habit,today,logs);
if (streak<2) continue;
const key=`habit-risk:${today}:${habit._id}`;
const result=await sendBackgroundPush(sub,{title:`Protect your ${streak} day streak`,body:`${habit.name} is still pending today.`,data:{page:'habits',habitId:String(habit._id),date:today,tag:key,urgency:'normal'}},key);
if(result.sent) sent++;
}
}
if (settings.habitWeeklySummary && parts.weekday==='Sun' && parts.hour>=18) {
const from=addDaysLocalDate(today,-6);
const completed=await HabitLog.countDocuments({userId:sub.userId,status:'completed',scheduledDate:{$gte:from,$lte:today}});
const scheduled=await Habit.find({userId:sub.userId,status:'active'}).lean();
let scheduledCount=0; for(const h of scheduled){let d=from;for(let i=0;i<7;i++){if(isHabitScheduledOnServer(h,d))scheduledCount++;d=addDaysLocalDate(d,1);}}
if(scheduledCount>0){const rate=Math.round((completed/Math.max(1,scheduledCount))*100);const key=`habit-weekly:${today}`;const result=await sendBackgroundPush(sub,{title:'Your weekly habit review',body:`${rate}% completion across your scheduled habits this week.`,data:{page:'habits',tag:key,urgency:'low'}},key);if(result.sent)sent++;}
}
}
return {configured:true,checked,sent};
}

// ============================================
// AUTHENTICATION ROUTES
// ============================================
const forgotPasswordRateMap = new Map();
const authRateMap = new Map();
function isRateLimited(key, max = 5, windowMs = 15 * 60 * 1000) {
const now = Date.now();
const entry = forgotPasswordRateMap.get(key) || { count: 0, resetAt: now + windowMs };
if (now > entry.resetAt) {
entry.count = 0;
entry.resetAt = now + windowMs;
}
entry.count += 1;
forgotPasswordRateMap.set(key, entry);
return entry.count > max;
}

function isAuthRateLimited(key, max = 10, windowMs = 15 * 60 * 1000) {
return isRateLimited(`auth:${key}`, max, windowMs);
}

// Register
app.post('/api/auth/register', ensureConnection, async (req, res) => {
try {
const { username, email, password } = req.body || {};
const registerKey = `${req.ip}:${String(email || '').trim().toLowerCase()}`;
if (isAuthRateLimited(registerKey, 8)) {
return res.status(429).json({ error: 'Too many registration attempts. Please try again later.' });
}
if (!username || !email || !password || typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
return res.status(400).json({ error: 'Username, email and password required' });
}
if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
return res.status(400).json({ error: 'Password must be 8+ chars with upper, lower, and number' });
}

const existingUser = await User.findOne({ username });
if (existingUser) {
return res.status(400).json({ error: 'Username already exists' });
}
const existingEmail = await User.findOne({ email: email.toLowerCase().trim() });
if (existingEmail) {
return res.status(400).json({ error: 'Email already exists' });
}

const hashedPassword = await bcrypt.hash(password, 10);

const user = new User({
username,
email: email.toLowerCase().trim(),
password: hashedPassword
});

await user.save();

// Create default vaults
const defaultVaults = [
{ name: 'Sovereign Capital Vault', percentage: 50, description: 'Locked capital for empire building' },
{ name: 'Risk Lab Wallet', percentage: 20, description: 'For trades, loops, experiments' },
{ name: 'Infrastructure Vault', percentage: 10, description: 'For tools, scripts, books' },
{ name: 'Core Survival Vault', percentage: 10, description: 'Essential needs' },
{ name: 'Chaos Play Vault', percentage: 10, description: 'Spend freely' }
];

for (const vaultData of defaultVaults) {
const vault = new Vault({
userId: user._id,
...vaultData
});
await vault.save();
}

const token = jwt.sign(
{ userId: user._id, username: user.username },
process.env.JWT_SECRET,
{ expiresIn: AUTH_TOKEN_TTL }
);

res.status(201).json({
  message: 'User registered successfully',
  token,
  user: {
    id: user._id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt
  }
});

} catch (error) {
console.error('Register error:', error);
res.status(500).json({ error: 'Server error during registration' });
}
});

// Login
app.post('/api/auth/login', ensureConnection, async (req, res) => {
try {
const { username, password } = req.body || {};
const identifier = typeof username === 'string' ? username.trim().toLowerCase() : '';
if (isAuthRateLimited(`${req.ip}:${identifier}`, 10)) {
return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
}
if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
return res.status(400).json({ error: 'Username and password required' });
}
const user = await User.findOne({
$or: [{ username: username.trim() }, { email: identifier }]
});
if (!user) {
return res.status(401).json({ error: 'Invalid credentials' });
}

const validPassword = await bcrypt.compare(password, user.password);
if (!validPassword) {
return res.status(401).json({ error: 'Invalid credentials' });
}

if (!process.env.JWT_SECRET) {
return res.status(500).json({ error: 'Server auth configuration error' });
}

const token = jwt.sign(
{ userId: user._id, username: user.username },
process.env.JWT_SECRET,
{ expiresIn: AUTH_TOKEN_TTL }
);

res.json({
  message: 'Login successful',
  token,
  user: {
    id: user._id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt
  }
});

} catch (error) {
console.error('Login error:', error);
res.status(500).json({ error: 'Server error during login' });
}
});


app.post('/api/auth/forgot-password', ensureConnection, async (req, res) => {
try {
const { email } = req.body || {};
const generic = { message: 'If an account exists, a reset link has been sent.' };
if (!email || typeof email !== 'string') return res.json(generic);
const normalizedEmail = email.toLowerCase().trim();
const rlKey = `${req.ip}:${normalizedEmail}`;
if (isRateLimited(rlKey)) return res.status(429).json(generic);

const user = await User.findOne({ email: normalizedEmail });
if (!user) return res.json(generic);

const rawToken = crypto.randomBytes(32).toString('hex');
const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
user.passwordResetTokenHash = tokenHash;
user.passwordResetTokenType = 'password_reset';
user.passwordResetExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
await user.save();

const resetUrl = `${req.protocol}://${req.get('host')}/reset-password?token=${rawToken}`;
console.log(`[SECURITY] Password reset requested for user=${user.username} at ${new Date().toISOString()}`);
if (EMAIL_USER && EMAIL_PASS) {
await mailTransporter.sendMail({
from: `"VaultFlow Security" <${EMAIL_USER}>`,
to: user.email,
subject: 'VaultFlow Password Reset',
html: `<div style="font-family:Arial,sans-serif"><h2>Reset your VaultFlow password</h2><p>Click below to reset your password (valid for 15 minutes):</p><p><a href="${resetUrl}" style="padding:10px 14px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;">Reset Password</a></p><p>If you did not request this, ignore this email.</p></div>`
});
} else {
console.warn('[SECURITY] Email transport is not configured; password reset email was not sent.');
}
return res.json(generic);
} catch (error) {
console.error('Forgot password error:', error);
return res.json({ message: 'If an account exists, a reset link has been sent.' });
}
});

app.post('/api/auth/reset-password', ensureConnection, async (req, res) => {
try {
const { token, password, confirmPassword } = req.body || {};
if (isAuthRateLimited(`${req.ip}:reset`, 10)) return res.status(429).json({ error: 'Too many password reset attempts. Please try again later.' });
if (!token || !password || !confirmPassword) return res.status(400).json({ error: 'Token and password are required' });
if (password !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match' });
if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
return res.status(400).json({ error: 'Password must be 8+ chars with upper, lower, and number' });
}
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
const user = await User.findOne({
passwordResetTokenHash: tokenHash,
passwordResetTokenType: 'password_reset',
passwordResetExpiresAt: { $gt: new Date() }
});
if (!user) return res.status(400).json({ error: 'Invalid or expired reset token' });

user.password = await bcrypt.hash(password, 10);
user.passwordResetTokenHash = undefined;
user.passwordResetTokenType = undefined;
user.passwordResetExpiresAt = undefined;
await user.save();
console.log(`[SECURITY] Password reset completed for user=${user.username} at ${new Date().toISOString()}`);
return res.json({ message: 'Password reset successful. Please login with your new password.' });
} catch (error) {
console.error('Reset password error:', error);
return res.status(500).json({ error: 'Server error during password reset' });
}
});


// ============================================
// FINANCIAL CONSISTENCY HELPERS
// ============================================

function normalizeAmount(value) {
const amount = Number(value);
return Number.isFinite(amount) && amount > 0 ? amount : null;
}

async function assertOwnedVault(userId, vaultId, session = null) {
if (!vaultId) return null;
return assertOwnedResource(Vault, userId, vaultId, {
select: '_id name',
session,
notFoundMessage: 'Vault not found'
});
}

async function rebuildVaultBalances(userId, session = null) {
const transactionQuery = Transaction.find({ userId }).lean();
const vaultQuery = Vault.find({ userId }).lean();
if (session) {
transactionQuery.session(session);
vaultQuery.session(session);
}

const [transactions, vaults] = await Promise.all([
transactionQuery.exec(),
vaultQuery.exec()
]);

const totals = new Map(vaults.map(v => [
String(v._id),
{ totalIncome: 0, totalSpent: 0 }
]));

// Income is allocated according to the user's current vault percentages.
// Expense belongs only to the transaction's selected vault.
for (const txn of transactions) {
const amount = Number(txn.amount) || 0;

if (txn.type === 'income') {
for (const vault of vaults) {
const allocation = (amount * Number(vault.percentage || 0)) / 100;
const bucket = totals.get(String(vault._id));
if (bucket) bucket.totalIncome += allocation;
}
} else if (txn.type === 'expense' && txn.vaultId) {
const bucket = totals.get(String(txn.vaultId));
if (bucket) bucket.totalSpent += amount;
}
}

for (const vault of vaults) {
const bucket = totals.get(String(vault._id));
const totalIncome = bucket?.totalIncome || 0;
const totalSpent = bucket?.totalSpent || 0;

await Vault.updateOne(
{ _id: vault._id, userId },
{
$set: {
totalIncome,
totalSpent,
balance: totalIncome - totalSpent
}
},
session ? { session } : undefined
);
}

return totals;
}

async function runFinancialMutation(work) {
const session = await mongoose.startSession();
try {
let result;
await session.withTransaction(async () => {
result = await work(session);
});
return result;
} finally {
await session.endSession();
}
}

// ============================================

// ============================================
// PHASE 4 PLATFORM HELPERS
// ============================================
function auditMutation(req, res) {
  if (!req.user || !req.path.startsWith('/api/') || !['POST','PUT','PATCH','DELETE'].includes(req.method)) return;
  res.on('finish', () => {
    const resource = req.path.split('/').filter(Boolean)[1] || 'api';
    const id = req.params && req.params.id ? String(req.params.id) : null;
    AuditEvent.create({
      userId: req.user.userId,
      action: `${req.method.toLowerCase()}:${resource}`,
      resource,
      resourceId: id,
      method: req.method,
      path: req.path,
      success: res.statusCode < 400,
      statusCode: res.statusCode,
      metadata: { phase: '4.x' }
    }).catch(error => console.error('[Audit] write failed:', error.message));
  });
}
app.use(auditMutation);

function normalizeSearchQuery(value) {
  return String(value || '').trim().slice(0, 100);
}

async function getUserDomainSnapshot(userId) {
  const [transactions, vaults, goals, habits, habitLogs] = await Promise.all([
    Transaction.find({ userId }).lean(),
    Vault.find({ userId }).lean(),
    Goal.find({ userId }).lean(),
    Habit.find({ userId }).lean(),
    HabitLog.find({ userId }).lean()
  ]);
  return { transactions, vaults, goals, habits, habitLogs };
}

async function claimMutationReceipt(userId, key, type) {
  if (!key || typeof key !== 'string' || key.length > 160) return null;
  try {
    return await MutationReceipt.create({ userId, key, type });
  } catch (error) {
    if (error && error.code === 11000) {
      return MutationReceipt.findOne({ userId, key }).lean();
    }
    throw error;
  }
}

// VAULT ROUTES (OPTIMIZED)
// ============================================

// Get all vaults
app.get('/api/vaults', ensureConnection, authenticateToken, async (req, res) => {
try {
const vaults = await Vault.find({ userId: req.user.userId })
.sort({ createdAt: 1 })
.lean()
.maxTimeMS(10000);

res.json(vaults);
} catch (error) {
console.error('Get vaults error:', error);
res.status(500).json({ error: 'Server error fetching vaults' });
}
});

// Create vault
app.post('/api/vaults', ensureConnection, authenticateToken, async (req, res) => {
try {
const { name, percentage, description } = req.body;

if (!name || percentage === undefined) {
return res.status(400).json({ error: 'Name and percentage required' });
}

const vault = new Vault({
userId: req.user.userId,
name,
percentage,
description
});

await vault.save();
res.status(201).json(vault);

} catch (error) {
console.error('Create vault error:', error);
res.status(500).json({ error: 'Server error creating vault' });
}
});

// Update vault
app.put('/api/vaults/:id', ensureConnection, authenticateToken, async (req, res) => {
try {
const { name, percentage, description } = req.body;
const normalizedPercentage = Number(percentage);

if (!name || !Number.isFinite(normalizedPercentage) || normalizedPercentage < 0 || normalizedPercentage > 100) {
return res.status(400).json({ error: 'Name and a percentage between 0 and 100 are required' });
}

const vault = await runFinancialMutation(async (session) => {
const updated = await Vault.findOneAndUpdate(
{ _id: req.params.id, userId: req.user.userId },
{ name, percentage: normalizedPercentage, description },
{ new: true, runValidators: true, session }
);

if (!updated) {
const error = new Error('Vault not found');
error.statusCode = 404;
throw error;
}

// Percentage changes affect income allocation, so cached totals must be rebuilt.
await rebuildVaultBalances(req.user.userId, session);

return Vault.findOne({
_id: req.params.id,
userId: req.user.userId
}).session(session).lean();
});

res.json(vault);

} catch (error) {
console.error('Update vault error:', error);
if (error.statusCode === 404) {
return res.status(404).json({ error: 'Vault not found' });
}
res.status(500).json({ error: 'Server error updating vault' });
}
});

// Delete vault
app.delete('/api/vaults/:id', ensureConnection, authenticateToken, async (req, res) => {
try {
await runFinancialMutation(async (session) => {
const vault = await Vault.findOne({
_id: req.params.id,
userId: req.user.userId
}).session(session);

if (!vault) {
const error = new Error('Vault not found');
error.statusCode = 404;
throw error;
}

// Do not delete a vault silently while references exist.
// Keeping the references would make historical transaction/goal data ambiguous.
const [transactionRefs, goalRefs] = await Promise.all([
Transaction.countDocuments({ userId: req.user.userId, vaultId: vault._id }).session(session),
Goal.countDocuments({ userId: req.user.userId, vaultId: vault._id }).session(session)
]);

if (transactionRefs > 0 || goalRefs > 0) {
const error = new Error('Vault is referenced by existing transactions or goals');
error.statusCode = 409;
throw error;
}

await Vault.deleteOne({
_id: req.params.id,
userId: req.user.userId
}, { session });

await rebuildVaultBalances(req.user.userId, session);
});

res.json({ message: 'Vault deleted successfully' });

} catch (error) {
console.error('Delete vault error:', error);
if (error.statusCode === 404) {
return res.status(404).json({ error: 'Vault not found' });
}
if (error.statusCode === 409) {
return res.status(409).json({
error: 'Vault cannot be deleted because transactions or goals still reference it'
});
}
res.status(500).json({ error: 'Server error deleting vault' });
}
});


// ============================================
// TRANSACTION ROUTES
// ============================================

// Get all transactions
app.get('/api/transactions', ensureConnection, authenticateToken, async (req, res) => {
try {
const transactions = await Transaction.find({ userId: req.user.userId })
.sort({ date: -1, time: -1 })
.lean()
.maxTimeMS(10000);

res.json(transactions);
} catch (error) {
console.error('Get transactions error:', error);
res.status(500).json({ error: 'Server error fetching transactions' });
}
});

// Create transaction
app.post('/api/transactions', ensureConnection, authenticateToken, async (req, res) => {
try {
const { date, time, type, amount, category, location, wallet, paymentMethod, vaultId, vaultName, notes } = req.body;
const normalizedAmount = normalizeAmount(amount);

if (!date || !type || !normalizedAmount || !category) {
return res.status(400).json({ error: 'Date, type, amount, and category required' });
}

const transaction = await runFinancialMutation(async (session) => {
const ownedVault = await assertOwnedVault(req.user.userId, vaultId || null, session);
const created = new Transaction({
userId: req.user.userId,
date,
time,
type,
amount: normalizedAmount,
category,
location,
wallet,
paymentMethod: paymentMethod || 'online',
vaultId: ownedVault?._id || null,
vaultName: ownedVault?.name || undefined,
notes
});

await created.save({ session });
await rebuildVaultBalances(req.user.userId, session);
return created;
});

res.status(201).json(transaction);

} catch (error) {
console.error('Create transaction error:', error);
res.status(500).json({ error: 'Server error creating transaction' });
}
});


// Update transaction
app.put('/api/transactions/:id', ensureConnection, authenticateToken, async (req, res) => {
try {
const { date, time, type, amount, category, location, wallet, paymentMethod, vaultId, vaultName, notes } = req.body;
const normalizedAmount = normalizeAmount(amount);

if (!date || !type || !normalizedAmount || !category) {
return res.status(400).json({ error: 'Date, type, amount, and category required' });
}

const transaction = await runFinancialMutation(async (session) => {
const ownedVault = await assertOwnedVault(req.user.userId, vaultId || null, session);
const oldTransaction = await Transaction.findOne({
_id: req.params.id,
userId: req.user.userId
}).session(session);

if (!oldTransaction) {
const error = new Error('Transaction not found');
error.statusCode = 404;
throw error;
}

const updated = await Transaction.findOneAndUpdate(
{ _id: req.params.id, userId: req.user.userId },
{
date,
time,
type,
amount: normalizedAmount,
category,
location,
wallet,
paymentMethod: paymentMethod || 'online',
vaultId: ownedVault?._id || null,
vaultName: ownedVault?.name || undefined,
notes
},
{ new: true, runValidators: true, session }
);

await rebuildVaultBalances(req.user.userId, session);
return updated;
});

res.json(transaction);

} catch (error) {
console.error('Update transaction error:', error);
if (error.statusCode === 404) {
return res.status(404).json({ error: 'Transaction not found' });
}
res.status(500).json({ error: 'Server error updating transaction' });
}
});

// Delete transaction
app.delete('/api/transactions/:id', ensureConnection, authenticateToken, async (req, res) => {
try {
await runFinancialMutation(async (session) => {
const transaction = await Transaction.findOne({
_id: req.params.id,
userId: req.user.userId
}).session(session);

if (!transaction) {
const error = new Error('Transaction not found');
error.statusCode = 404;
throw error;
}

await Transaction.deleteOne({
_id: req.params.id,
userId: req.user.userId
}, { session });

await rebuildVaultBalances(req.user.userId, session);
});

res.json({ message: 'Transaction deleted successfully' });

} catch (error) {
console.error('Delete transaction error:', error);
if (error.statusCode === 404) {
return res.status(404).json({ error: 'Transaction not found' });
}
res.status(500).json({ error: 'Server error deleting transaction' });
}
});


// ============================================
// GOAL ROUTES (AUTO-UPDATE CURRENT AMOUNT)
// ============================================

// Get all goals (auto-link vault balance as currentAmount)
app.get('/api/goals', ensureConnection, authenticateToken, async (req, res) => {
try {
const goals = await Goal.find({ userId: req.user.userId })
.sort({ createdAt: -1 })
.lean()
.maxTimeMS(10000);

// Get map of vaultId => balance for this user
const vaults = await Vault.find({ userId: req.user.userId }).lean();
const vaultMap = {};
vaults.forEach(vault => {
vaultMap[String(vault._id)] = vault.balance || 0;
});

// Overwrite each goal.currentAmount with vault balance (if linked)
goals.forEach(g => {
if (g.vaultId && vaultMap[String(g.vaultId)]) {
g.currentAmount = vaultMap[String(g.vaultId)];
}
});

res.json(goals);
} catch (error) {
console.error('Get goals error:', error);
res.status(500).json({ error: 'Server error fetching goals' });
}
});

// Create goal (FIXED)
app.post('/api/goals', ensureConnection, authenticateToken, async (req, res) => {
try {
let { name, targetAmount, currentAmount, vaultId, vaultName, deadline, status, notes } = req.body;

if (!name || !targetAmount) {
return res.status(400).json({ error: 'Name and target amount required' });
}

// FIX: Handle empty vaultId
if (vaultId === '' || vaultId === 'null' || vaultId === 'undefined') {
vaultId = null;
}

const ownedVault = await assertOwnedVault(req.user.userId, vaultId || null);
const goal = new Goal({
userId: req.user.userId,
name,
targetAmount,
currentAmount: currentAmount || 0,
vaultId: ownedVault?._id || null,
vaultName: ownedVault?.name || undefined,
deadline,
status: status || 'active',
notes
});

await goal.save();
res.status(201).json(goal);

} catch (error) {
console.error('Create goal error:', error);
res.status(500).json({ error: 'Server error creating goal' });
}
});

// Update goal (FIXED)
app.put('/api/goals/:id', ensureConnection, authenticateToken, async (req, res) => {
try {
let { name, targetAmount, currentAmount, vaultId, vaultName, deadline, status, notes } = req.body;

// FIX: Handle empty vaultId
if (vaultId === '' || vaultId === 'null' || vaultId === 'undefined') {
vaultId = null;
}

const ownedVault = await assertOwnedVault(req.user.userId, vaultId || null);
const goal = await Goal.findOneAndUpdate(
{ _id: req.params.id, userId: req.user.userId },
{ name, targetAmount, currentAmount, vaultId: ownedVault?._id || null, vaultName: ownedVault?.name || undefined, deadline, status, notes },
{ new: true, runValidators: true }
);

if (!goal) {
return res.status(404).json({ error: 'Goal not found' });
}

res.json(goal);

} catch (error) {
console.error('Update goal error:', error);
res.status(500).json({ error: 'Server error updating goal' });
}
});

// Delete goal
app.delete('/api/goals/:id', ensureConnection, authenticateToken, async (req, res) => {
try {
const goal = await Goal.findOneAndDelete({
_id: req.params.id,
userId: req.user.userId
});

if (!goal) {
return res.status(404).json({ error: 'Goal not found' });
}

res.json({ message: 'Goal deleted successfully' });

} catch (error) {
console.error('Delete goal error:', error);
res.status(500).json({ error: 'Server error deleting goal' });
}
});

// ============================================
// HABIT ROUTES
// ============================================

// Get habits for the authenticated user.
// Archived habits are included so history remains accessible.
app.get('/api/habits', ensureConnection, authenticateToken, async (req, res) => {
try {
const habits = await Habit.find({ userId: req.user.userId })
.sort({ status: 1, createdAt: -1 })
.lean()
.maxTimeMS(10000);

res.json(habits);
} catch (error) {
console.error('Get habits error:', error);
res.status(500).json({ error: 'Server error fetching habits' });
}
});

// Get all HabitLogs for the authenticated user. Used by the client store and backup/restore.
app.get('/api/habit-logs', ensureConnection, authenticateToken, async (req, res) => {
try {
const query = { userId: req.user.userId };
if (req.query.from || req.query.to) {
query.scheduledDate = {};
if (req.query.from) {
if (!isValidLocalDate(req.query.from)) return res.status(400).json({ error: 'Invalid from date' });
query.scheduledDate.$gte = req.query.from;
}
if (req.query.to) {
if (!isValidLocalDate(req.query.to)) return res.status(400).json({ error: 'Invalid to date' });
query.scheduledDate.$lte = req.query.to;
}
}
const logs = await HabitLog.find(query).sort({ scheduledDate: -1 }).lean().maxTimeMS(10000);
res.json(logs);
} catch (error) {
console.error('Get all habit logs error:', error);
res.status(500).json({ error: 'Server error fetching habit logs' });
}
});

// Get one habit.
app.get('/api/habits/:id', ensureConnection, authenticateToken, async (req, res) => {
try {
const habit = await Habit.findOne({
_id: req.params.id,
userId: req.user.userId
}).lean();

if (!habit) return res.status(404).json({ error: 'Habit not found' });
res.json(habit);
} catch (error) {
console.error('Get habit error:', error);
res.status(500).json({ error: 'Server error fetching habit' });
}
});

// Create habit.
app.post('/api/habits', ensureConnection, authenticateToken, async (req, res) => {
try {
const normalized = normalizeHabitPayload(req.body);
if (normalized.error) return res.status(400).json({ error: normalized.error });
if (!normalized.value.name) return res.status(400).json({ error: 'Habit name required' });

const habit = new Habit({
userId: req.user.userId,
...normalized.value
});
await habit.save();

res.status(201).json(habit);
} catch (error) {
console.error('Create habit error:', error);
res.status(400).json({ error: error.message || 'Invalid habit data' });
}
});

// Update habit.
// Historical HabitLogs are intentionally untouched.
app.put('/api/habits/:id', ensureConnection, authenticateToken, async (req, res) => {
try {
const habit = await Habit.findOne({
_id: req.params.id,
userId: req.user.userId
});

if (!habit) return res.status(404).json({ error: 'Habit not found' });

const normalized = normalizeHabitPayload(req.body, habit);
if (normalized.error) return res.status(400).json({ error: normalized.error });
if (!normalized.value.name) return res.status(400).json({ error: 'Habit name required' });

Object.assign(habit, normalized.value);
habit.updatedAt = new Date();
await habit.save();

res.json(habit);
} catch (error) {
console.error('Update habit error:', error);
res.status(400).json({ error: error.message || 'Invalid habit data' });
}
});

// Archive a habit. This is the normal destructive-looking UI action.
app.delete('/api/habits/:id', ensureConnection, authenticateToken, async (req, res) => {
try {
const habit = await Habit.findOneAndUpdate(
{ _id: req.params.id, userId: req.user.userId },
{ $set: { status: 'archived', updatedAt: new Date() } },
{ new: true, runValidators: true }
);

if (!habit) return res.status(404).json({ error: 'Habit not found' });
res.json(habit);
} catch (error) {
console.error('Archive habit error:', error);
res.status(500).json({ error: 'Server error archiving habit' });
}
});

// Get logs for one owned habit.
app.get('/api/habits/:id/logs', ensureConnection, authenticateToken, async (req, res) => {
try {
const habit = await Habit.findOne({
_id: req.params.id,
userId: req.user.userId
}).select('_id').lean();

if (!habit) return res.status(404).json({ error: 'Habit not found' });

const query = { userId: req.user.userId, habitId: habit._id };
if (req.query.from || req.query.to) {
query.scheduledDate = {};
if (req.query.from) {
if (!isValidLocalDate(req.query.from)) return res.status(400).json({ error: 'Invalid from date' });
query.scheduledDate.$gte = req.query.from;
}
if (req.query.to) {
if (!isValidLocalDate(req.query.to)) return res.status(400).json({ error: 'Invalid to date' });
query.scheduledDate.$lte = req.query.to;
}
}

const logs = await HabitLog.find(query)
.sort({ scheduledDate: -1 })
.lean()
.maxTimeMS(10000);

res.json(logs);
} catch (error) {
console.error('Get habit logs error:', error);
res.status(500).json({ error: 'Server error fetching habit logs' });
}
});

// Create/update one scheduled occurrence.
// The compound unique index makes this idempotent at the database level.
app.post('/api/habits/:id/logs', ensureConnection, authenticateToken, async (req, res) => {
try {
const habit = await Habit.findOne({
_id: req.params.id,
userId: req.user.userId
}).lean();

if (!habit) return res.status(404).json({ error: 'Habit not found' });

const { scheduledDate, status, note } = req.body;

if (!isValidLocalDate(scheduledDate)) {
return res.status(400).json({ error: 'scheduledDate must be a valid YYYY-MM-DD date' });
}
if (!['completed', 'skipped'].includes(status)) {
return res.status(400).json({ error: 'status must be completed or skipped' });
}
if (scheduledDate < habit.startDate) {
return res.status(400).json({ error: 'scheduledDate cannot be before the habit startDate' });
}
if (habit.endDate && scheduledDate > habit.endDate) {
return res.status(400).json({ error: 'scheduledDate cannot be after the habit endDate' });
}

const update = {
status,
note: note ?? '',
updatedAt: new Date()
};

if (status === 'completed') {
update.completedAt = new Date();
} else {
update.completedAt = undefined;
}

const log = await HabitLog.findOneAndUpdate(
{ userId: req.user.userId, habitId: habit._id, scheduledDate },
{
$set: update,
$setOnInsert: {
userId: req.user.userId,
habitId: habit._id,
scheduledDate,
createdAt: new Date()
}
},
{ new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
);

res.status(201).json(log);
} catch (error) {
console.error('Create habit log error:', error);
if (error?.code === 11000) {
return res.status(409).json({ error: 'A log already exists for this habit and date' });
}
res.status(400).json({ error: error.message || 'Invalid habit log data' });
}
});

// Update an existing log.
app.put('/api/habit-logs/:id', ensureConnection, authenticateToken, async (req, res) => {
try {
const { status, note } = req.body;
if (!['completed', 'skipped'].includes(status)) {
return res.status(400).json({ error: 'status must be completed or skipped' });
}

const log = await HabitLog.findOne({
_id: req.params.id,
userId: req.user.userId
});

if (!log) return res.status(404).json({ error: 'Habit log not found' });

const habit = await Habit.findOne({
_id: log.habitId,
userId: req.user.userId
}).select('_id').lean();

if (!habit) return res.status(404).json({ error: 'Habit not found' });

log.status = status;
log.note = note ?? log.note ?? '';
log.updatedAt = new Date();
log.completedAt = status === 'completed' ? new Date() : undefined;
await log.save();

res.json(log);
} catch (error) {
console.error('Update habit log error:', error);
res.status(400).json({ error: error.message || 'Invalid habit log data' });
}
});

// Delete a log (undo the explicit completion/skip).
app.delete('/api/habit-logs/:id', ensureConnection, authenticateToken, async (req, res) => {
try {
const log = await HabitLog.findOneAndDelete({
_id: req.params.id,
userId: req.user.userId
});

if (!log) return res.status(404).json({ error: 'Habit log not found' });
res.json({ message: 'Habit log deleted successfully' });
} catch (error) {
console.error('Delete habit log error:', error);
res.status(500).json({ error: 'Server error deleting habit log' });
}
});

// Habit summary foundation. This intentionally returns stored logs only;
// missed/schedule/streak derivation belongs to the domain service phase.

// Return the public VAPID key used by browser PushManager.
app.get('/api/notifications/status', ensureConnection, authenticateToken, async (req, res) => {
  try {
    const subscriptionCount = await PushSubscription.countDocuments({ userId: req.user.userId });
    const settings = await NotificationSettings.findOne({ userId: req.user.userId }).lean();
    res.json({
      supported: Boolean(process.env.VAPID_PUBLIC_KEY),
      subscribed: subscriptionCount > 0,
      enabled: settings?.enabled !== false,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    });
  } catch (error) {
    console.error('Notification status error:', error);
    res.status(500).json({ error: 'Failed to read notification status' });
  }
});

app.get('/api/notifications/vapid-public-key', ensureConnection, authenticateToken, async (req,res)=>{
if(!pushConfigured()) return res.status(503).json({ error:'Background push is not configured on this deployment' });
res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.get('/api/notifications/settings', ensureConnection, authenticateToken, async (req,res)=>{
try { const settings=await NotificationSettings.findOne({userId:req.user.userId}).lean(); res.json(settings || {userId:req.user.userId,enabled:false,dailyReminder:true,weeklySummary:true,savingsInsights:true,habitReminder:true,habitWeeklySummary:true,habitRisk:true}); }
catch(error){console.error('Notification settings GET error:',error);res.status(500).json({error:'Server error fetching notification settings'});}
});

app.put('/api/notifications/settings', ensureConnection, authenticateToken, async (req,res)=>{
try { const allowed=['enabled','dailyReminder','weeklySummary','savingsInsights','habitReminder','habitWeeklySummary','habitRisk']; const update={}; for(const key of allowed) if(req.body[key]!==undefined) update[key]=Boolean(req.body[key]); update.updatedAt=new Date(); const settings=await NotificationSettings.findOneAndUpdate({userId:req.user.userId},{$set:update,$setOnInsert:{userId:req.user.userId}},{new:true,upsert:true,setDefaultsOnInsert:true}).lean(); res.json(settings); }
catch(error){console.error('Notification settings PUT error:',error);res.status(500).json({error:'Server error saving notification settings'});}
});

app.post('/api/notifications/subscribe', ensureConnection, authenticateToken, async (req,res)=>{
try {
if(!pushConfigured()) return res.status(503).json({error:'Background push is not configured on this deployment'});
const sub=req.body?.subscription || req.body;
if(!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return res.status(400).json({error:'A valid PushSubscription is required'});
const timezone=typeof req.body?.timezone==='string' && isValidTimeZone(req.body.timezone) ? req.body.timezone : 'UTC';
const userAgent=String(req.headers['user-agent']||'').slice(0,500);
const existing=await PushSubscription.findOne({endpoint:sub.endpoint}).lean();
if (existing && String(existing.userId) !== String(req.user.userId)) {
return res.status(409).json({error:'Push subscription belongs to another account'});
}
const saved=await PushSubscription.findOneAndUpdate(
{endpoint:sub.endpoint,userId:req.user.userId},
{$set:{userId:req.user.userId,endpoint:sub.endpoint,p256dh:sub.keys.p256dh,auth:sub.keys.auth,timezone,userAgent,updatedAt:new Date(),lastSeenAt:new Date()}},
{new:true,upsert:true,setDefaultsOnInsert:true}
).lean();
await NotificationSettings.findOneAndUpdate({userId:req.user.userId},{$setOnInsert:{userId:req.user.userId}},{upsert:true,setDefaultsOnInsert:true});
res.status(201).json({id:saved._id,endpoint:saved.endpoint,timezone:saved.timezone});
} catch(error){
console.error('Push subscribe error:',error);
if (error?.code === 11000) return res.status(409).json({error:'Push subscription is already registered to another account'});
res.status(500).json({error:'Server error saving push subscription'});
}
});

app.get('/api/notifications/subscriptions', ensureConnection, authenticateToken, async (req,res)=>{
try { const rows=await PushSubscription.find({userId:req.user.userId}).select('_id endpoint timezone createdAt updatedAt lastSeenAt').sort({updatedAt:-1}).lean(); res.json(rows); }
catch(error){res.status(500).json({error:'Server error fetching push subscriptions'});}
});

app.delete('/api/notifications/subscribe', ensureConnection, authenticateToken, async (req,res)=>{
try { const endpoint=req.body?.endpoint; if(!endpoint)return res.status(400).json({error:'endpoint is required'}); await PushSubscription.deleteOne({userId:req.user.userId,endpoint}); res.json({success:true}); }
catch(error){res.status(500).json({error:'Server error removing push subscription'});}
});

// Vercel invokes this endpoint from the production cron job. It is also manually callable with CRON_SECRET for testing.
app.get('/api/cron/notifications', ensureConnection, async (req,res)=>{
try {
const expected=process.env.CRON_SECRET;
const auth=req.headers.authorization || '';
if (!expected || auth !== `Bearer ${expected}`) return res.status(401).json({error:'Unauthorized'});
const result=await runBackgroundNotificationJob(new Date());
const automation=await evaluateAutomationRules(new Date());
res.json({ok:true,...result,automation});
} catch(error){console.error('Background notification job error:',error);res.status(500).json({error:'Background notification job failed'});}
});

app.get('/api/habits/summary', ensureConnection, authenticateToken, async (req, res) => {
try {
const userId = req.user.userId;
const [habits, logs] = await Promise.all([
Habit.find({ userId, status: { $ne: 'archived' } }).lean(),
HabitLog.find({ userId }).lean()
]);

res.json({
habitCount: habits.length,
activeCount: habits.filter(h => h.status === 'active').length,
pausedCount: habits.filter(h => h.status === 'paused').length,
logCount: logs.length
});
} catch (error) {
console.error('Get habit summary error:', error);
res.status(500).json({ error: 'Server error fetching habit summary' });
}
});

// ============================================

// ============================================
// PHASE 4 INTELLIGENCE / AUTOMATION / SEARCH
// ============================================
app.get('/api/insights', ensureConnection, authenticateToken, async (req, res) => {
  try {
    const snapshot = await getUserDomainSnapshot(req.user.userId);
    const financial = calculateFinancialIntelligence(snapshot.transactions);
    const projections = calculateGoalProjections(snapshot.goals, snapshot.transactions);
    const habits = calculateHabitSnapshot(snapshot.habits, snapshot.habitLogs);
    const recurring = detectRecurringExpenses(snapshot.transactions);
    const insights = buildInsights(financial, projections, habits, recurring);
    res.json({ financial, goals: projections, habits, recurring, insights });
  } catch (error) {
    console.error('Phase 4 insights error:', error);
    res.status(500).json({ error: 'Failed to build insights' });
  }
});

app.get('/api/goals/projections', ensureConnection, authenticateToken, async (req, res) => {
  try {
    const [goals, transactions] = await Promise.all([
      Goal.find({ userId: req.user.userId }).lean(),
      Transaction.find({ userId: req.user.userId }).lean()
    ]);
    res.json({ projections: calculateGoalProjections(goals, transactions) });
  } catch (error) {
    console.error('Goal projections error:', error);
    res.status(500).json({ error: 'Failed to build goal projections' });
  }
});

app.get('/api/search', ensureConnection, authenticateToken, async (req, res) => {
  try {
    const query = normalizeSearchQuery(req.query.q);
    if (!query) return res.json({ query: '', results: [] });
    const snapshot = await getUserDomainSnapshot(req.user.userId);
    res.json({ query, results: searchAll(query, snapshot) });
  } catch (error) {
    console.error('Global search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

app.get('/api/audit', ensureConnection, authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const events = await AuditEvent.find({ userId: req.user.userId }).sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ events });
  } catch (error) {
    console.error('Audit log error:', error);
    res.status(500).json({ error: 'Failed to load audit history' });
  }
});

app.get('/api/automation/rules', ensureConnection, authenticateToken, async (req, res) => {
  try {
    const rules = await AutomationRule.find({ userId: req.user.userId }).sort({ createdAt: -1 }).lean();
    res.json({ rules });
  } catch (error) {
    console.error('Automation rules error:', error);
    res.status(500).json({ error: 'Failed to load automation rules' });
  }
});

app.post('/api/automation/rules', ensureConnection, authenticateToken, async (req, res) => {
  try {
    const { name, event, condition, action, enabled } = req.body || {};
    if (!name || !event) return res.status(400).json({ error: 'Rule name and event are required' });
    const allowed = ['goal_at_risk','expense_threshold','habit_streak','weekly_summary'];
    if (!allowed.includes(event)) return res.status(400).json({ error: 'Unsupported automation event' });
    const rule = await AutomationRule.create({
      userId: req.user.userId,
      name: String(name).trim().slice(0,100),
      event,
      condition: condition && typeof condition === 'object' ? condition : {},
      action: action === 'in_app' ? 'in_app' : 'push',
      enabled: enabled !== false
    });
    res.status(201).json(rule);
  } catch (error) {
    console.error('Create automation rule error:', error);
    res.status(500).json({ error: 'Failed to create automation rule' });
  }
});

app.put('/api/automation/rules/:id', ensureConnection, authenticateToken, async (req, res) => {
  try {
    const update = {};
    for (const key of ['name','event','condition','action','enabled']) {
      if (req.body && req.body[key] !== undefined) update[key] = req.body[key];
    }
    if (update.event && !['goal_at_risk','expense_threshold','habit_streak','weekly_summary'].includes(update.event)) {
      return res.status(400).json({ error: 'Unsupported automation event' });
    }
    const rule = await AutomationRule.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId }, update,
      { new: true, runValidators: true }
    ).lean();
    if (!rule) return res.status(404).json({ error: 'Automation rule not found' });
    res.json(rule);
  } catch (error) {
    console.error('Update automation rule error:', error);
    res.status(500).json({ error: 'Failed to update automation rule' });
  }
});

app.delete('/api/automation/rules/:id', ensureConnection, authenticateToken, async (req, res) => {
  try {
    const deleted = await AutomationRule.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!deleted) return res.status(404).json({ error: 'Automation rule not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete automation rule error:', error);
    res.status(500).json({ error: 'Failed to delete automation rule' });
  }
});

app.post('/api/sync/mutations', ensureConnection, authenticateToken, async (req, res) => {
  try {
    const mutations = Array.isArray(req.body?.mutations) ? req.body.mutations.slice(0, 50) : [];
    const results = [];
    for (const mutation of mutations) {
      const key = String(mutation.key || '').trim();
      const type = String(mutation.type || '').trim();
      if (!key || !type) {
        results.push({ key, status: 'rejected', error: 'Missing mutation key/type' });
        continue;
      }
      const existing = await claimMutationReceipt(req.user.userId, key, type);
      if (existing && existing.result) {
        results.push({ key, status: 'already-applied', result: existing.result });
        continue;
      }
      try {
        let result;
        if (type === 'habit_log_create') {
          const habit = await Habit.findOne({ _id: mutation.payload?.habitId, userId: req.user.userId }).lean();
          if (!habit) throw Object.assign(new Error('Habit not found'), { statusCode: 404 });
          result = await HabitLog.findOneAndUpdate(
            { userId: req.user.userId, habitId: habit._id, scheduledDate: mutation.payload.scheduledDate },
            { $set: { status: mutation.payload.status || 'completed', note: mutation.payload.note || '' } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          ).lean();
        } else if (type === 'transaction_create') {
          const payload = mutation.payload || {};
          const ownedVault = await assertOwnedVault(req.user.userId, payload.vaultId || null);
          result = await Transaction.create({
            userId: req.user.userId,
            date: payload.date,
            time: payload.time || '',
            type: payload.type,
            amount: Number(payload.amount),
            category: payload.category || 'Uncategorized',
            location: payload.location || '',
            wallet: payload.wallet,
            paymentMethod: payload.paymentMethod || 'online',
            vaultId: ownedVault?._id || null,
            vaultName: ownedVault?.name || undefined,
            notes: payload.notes || ''
          });
          result = result.toObject();
        } else {
          throw Object.assign(new Error('Unsupported mutation type'), { statusCode: 400 });
        }
        await MutationReceipt.updateOne({ userId: req.user.userId, key }, { $set: { result } });
        results.push({ key, status: 'applied', result });
      } catch (error) {
        results.push({ key, status: 'failed', error: error.message });
      }
    }
    res.json({ results });
  } catch (error) {
    console.error('Sync mutations error:', error);
    res.status(500).json({ error: 'Failed to process sync queue' });
  }
});


// ANALYTICS ROUTES (ENHANCED WITH CHARTS)
// ============================================

// Get dashboard summary
app.get('/api/analytics/summary', ensureConnection, authenticateToken, async (req, res) => {
try {
const transactions = await Transaction.find({ userId: req.user.userId }).lean();

const totalIncome = transactions
.filter(t => t.type === 'income')
.reduce((sum, t) => sum + t.amount, 0);

const totalExpenses = transactions
.filter(t => t.type === 'expense')
.reduce((sum, t) => sum + t.amount, 0);

const netSavings = totalIncome - totalExpenses;
const savingsRate = totalIncome > 0 ? ((netSavings / totalIncome) * 100).toFixed(1) : 0;

res.json({
totalIncome,
totalExpenses,
netSavings,
savingsRate,
transactionCount: transactions.length
});

} catch (error) {
console.error('Get summary error:', error);
res.status(500).json({ error: 'Server error fetching summary' });
}
});

// Get full analytics for reports (with chart data)
app.get('/api/analytics/full', ensureConnection, authenticateToken, async (req, res) => {
try {
const userId = req.user.userId;
const transactions = await Transaction.find({ userId }).lean();
const vaults = await Vault.find({ userId }).lean();

// CHART 1: Income vs Expenses (Pie)
const totalIncome = transactions
.filter(t => t.type === 'income')
.reduce((sum, t) => sum + t.amount, 0);
const totalExpenses = transactions
.filter(t => t.type === 'expense')
.reduce((sum, t) => sum + t.amount, 0);

// CHART 2: Spending by Category (Bar)
const byCategory = {};
transactions
.filter(t => t.type === 'expense')
.forEach(t => {
if (!byCategory[t.category]) byCategory[t.category] = 0;
byCategory[t.category] += t.amount;
});

        // CHART 2B: Income by Category / Stream (Bar)
        const incomeByCategory = {};
        transactions
            .filter(t => t.type === 'income')
            .forEach(t => {
                const key = t.category || 'Uncategorized';
                if (!incomeByCategory[key]) incomeByCategory[key] = 0;
                incomeByCategory[key] += t.amount;
            });

// CHART 3: Spending by Vault (Bar)
const byVault = {};
transactions
.filter(t => t.type === 'expense' && t.vaultId)
.forEach(t => {
const key = t.vaultName || 'Unassigned';
if (!byVault[key]) byVault[key] = 0;
byVault[key] += t.amount;
});

// CHART 4: Monthly Trends (Line)
const byMonth = {};
transactions.forEach(t => {
const d = new Date(t.date);
const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
if (!byMonth[key]) {
byMonth[key] = { income: 0, expenses: 0 };
}
if (t.type === 'income') byMonth[key].income += t.amount;
if (t.type === 'expense') byMonth[key].expenses += t.amount;
});

const monthly = Object.keys(byMonth)
.sort()
.slice(-12) // Last 12 months only
.map(key => ({
month: key,
income: byMonth[key].income,
expenses: byMonth[key].expenses,
savings: byMonth[key].income - byMonth[key].expenses
}));

        // CHART 5: Savings Portfolio Trend (Cumulative Savings)
        let runningSavings = 0;
        const savingsPortfolio = monthly.map(item => {
            runningSavings += item.savings;
            return {
                month: item.month,
                value: runningSavings
            };
        });

// Current month data
const now = new Date();
const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const currentMonthData = byMonth[currentMonthKey] || { income: 0, expenses: 0 };

res.json({
currentMonth: {
income: currentMonthData.income,
expenses: currentMonthData.expenses,
savings: currentMonthData.income - currentMonthData.expenses
},
incomeVsExpenses: {
income: totalIncome,
expenses: totalExpenses
},
byCategory: Object.keys(byCategory).length > 0
  ? byCategory
  : { 'No data': 0 },

incomeByCategory: Object.keys(incomeByCategory).length > 0
  ? incomeByCategory
  : { 'No income': 0 },

byVault: Object.keys(byVault).length > 0
  ? byVault
  : { 'No expenses': 0 },

monthly: monthly.length > 0 ? monthly : [],

savingsPortfolio: savingsPortfolio
});

} catch (error) {
console.error('Full analytics error:', error);
res.status(500).json({ error: 'Server error fetching analytics' });
}
});

// Health check
app.get('/health', (req, res) => {
res.json({ status: 'ok', message: 'VaultFlow API is running' });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'production') {
app.listen(PORT, () => {
console.log(`🚀 VaultFlow server running on port ${PORT}`);
});
}

// Export for Vercel
module.exports = app;
