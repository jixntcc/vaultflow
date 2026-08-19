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
const { calculateFinancialIntelligence, detectRecurringExpenses, calculateGoalProjections, calculateHabitSnapshot, calculateFinanceHabitCorrelation, buildPersonalizationProfile, buildRetentionProfile, buildPlanProfile, buildInsights, searchAll } = require('./services/phase4-intelligence');
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
const JWT_ISSUER = process.env.JWT_ISSUER || 'vaultflow';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'vaultflow-web';
const JWT_ALGORITHM = 'HS256';
const PUBLIC_APP_URL = (process.env.PUBLIC_APP_URL || '').replace(/\/$/, '');
const RELEASE_VERSION = process.env.RELEASE_VERSION || require('./package.json').version || '0.0.0';
const RELEASE_COMMIT = process.env.RELEASE_COMMIT || 'local';
const OBSERVABILITY_WINDOW_MS = Number(process.env.OBSERVABILITY_WINDOW_MS || 5 * 60 * 1000);
const SLOW_REQUEST_MS = Number(process.env.SLOW_REQUEST_MS || 750);
const OBSERVABILITY_MAX_ROUTES = Number(process.env.OBSERVABILITY_MAX_ROUTES || 100);

const runtimeMetrics = {
  startedAt: Date.now(),
  requests: 0,
  responses: 0,
  errors: 0,
  slowRequests: 0,
  totalDurationMs: 0,
  status: {},
  routes: new Map(),
  recentErrors: []
};

function recordRouteMetric(routeKey, statusCode, durationMs) {
  let route = runtimeMetrics.routes.get(routeKey);
  if (!route) {
    if (runtimeMetrics.routes.size >= OBSERVABILITY_MAX_ROUTES) route = null;
    else {
      route = { requests: 0, errors: 0, slow: 0, totalDurationMs: 0 };
      runtimeMetrics.routes.set(routeKey, route);
    }
  }
  if (route) {
    route.requests += 1;
    route.totalDurationMs += durationMs;
    if (statusCode >= 500) route.errors += 1;
    if (durationMs >= SLOW_REQUEST_MS) route.slow += 1;
  }
}

function recordRuntimeError(error, req = null) {
  const item = {
    at: new Date().toISOString(),
    route: req ? String(req.route?.path || req.path || 'unknown').slice(0, 120) : 'unknown',
    method: req?.method || 'unknown',
    status: Number(error?.status || error?.statusCode || 500),
    message: String(error?.message || error || 'Unknown error').slice(0, 300)
  };
  runtimeMetrics.recentErrors.push(item);
  if (runtimeMetrics.recentErrors.length > 20) runtimeMetrics.recentErrors.shift();
}

function getRuntimeMetrics() {
  const now = Date.now();
  const ageMs = Math.max(1, now - runtimeMetrics.startedAt);
  const routes = {};
  for (const [key, value] of runtimeMetrics.routes.entries()) {
    routes[key] = {
      requests: value.requests,
      errors: value.errors,
      slow: value.slow,
      avgDurationMs: Number((value.totalDurationMs / Math.max(1, value.requests)).toFixed(1))
    };
  }
  return {
    windowMs: OBSERVABILITY_WINDOW_MS,
    startedAt: new Date(runtimeMetrics.startedAt).toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    requests: runtimeMetrics.requests,
    responses: runtimeMetrics.responses,
    errors: runtimeMetrics.errors,
    slowRequests: runtimeMetrics.slowRequests,
    errorRate: Number((runtimeMetrics.errors / Math.max(1, runtimeMetrics.requests)).toFixed(4)),
    avgResponseMs: Number((runtimeMetrics.totalDurationMs / Math.max(1, runtimeMetrics.responses)).toFixed(1)),
    requestsPerMinute: Number((runtimeMetrics.requests / (ageMs / 60000)).toFixed(2)),
    status: { ...runtimeMetrics.status },
    routes,
    recentErrors: runtimeMetrics.recentErrors.slice(-10)
  };
}


const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '100kb';
const API_RATE_LIMIT_MAX = Number(process.env.API_RATE_LIMIT_MAX || 180);
const API_RATE_LIMIT_WINDOW_MS = Number(process.env.API_RATE_LIMIT_WINDOW_MS || 60 * 1000);
const AUTH_RATE_LIMIT_MAX = Number(process.env.AUTH_RATE_LIMIT_MAX || 10);
const AUTH_RATE_LIMIT_WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const MAX_ARRAY_ITEMS = Number(process.env.MAX_ARRAY_ITEMS || 500);
const MAX_STRING_LENGTH = Number(process.env.MAX_STRING_LENGTH || 2000);
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
  app.use((req, res, next) => {
    const origin = req.get('Origin');

    // Same-origin browser requests should always be allowed. This prevents a
    // stale CORS_ORIGINS value (for example, localhost from development) from
    // breaking production login/API calls when frontend and API share the
    // same Vercel origin.
    if (!origin) return next();

    const host = String(req.get('host') || '');
    const sameOrigin =
      origin === `https://${host}` ||
      origin === `http://${host}`;

    if (sameOrigin || configuredCorsOrigins.includes(origin)) {
      return cors()(req, res, next);
    }

    return next(new Error('CORS origin not allowed'));
  });
}

app.disable('x-powered-by');

// Only trust the first proxy hop when explicitly enabled. This prevents
// clients from spoofing req.ip in deployments that are not behind a proxy.
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  if (process.env.NODE_ENV === 'production' && req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Lightweight in-process request telemetry. It intentionally records only
// aggregate route/status/timing data and never request bodies, auth tokens, or PII.
app.use((req, res, next) => {
  const started = process.hrtime.bigint();
  runtimeMetrics.requests += 1;

  // Set Server-Timing before headers are committed. Mutating headers from
  // `finish` throws ERR_HTTP_HEADERS_SENT in Node/Vercel.
  const originalEnd = res.end;
  res.end = function patchedResponseEnd(chunk, encoding, callback) {
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    if (!res.headersSent) {
      res.setHeader('Server-Timing', `app;dur=${durationMs.toFixed(1)}`);
    }
    return originalEnd.call(this, chunk, encoding, callback);
  };

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    runtimeMetrics.responses += 1;
    runtimeMetrics.totalDurationMs += durationMs;

    const status = res.statusCode;
    const statusKey = String(status);
    runtimeMetrics.status[statusKey] = (runtimeMetrics.status[statusKey] || 0) + 1;
    if (status >= 500) runtimeMetrics.errors += 1;
    if (durationMs >= SLOW_REQUEST_MS) runtimeMetrics.slowRequests += 1;

    const routeKey = `${req.method} ${String(req.route?.path || req.path || '/').slice(0, 120)}`;
    recordRouteMetric(routeKey, status, durationMs);
    // Response headers are already committed when `finish` fires. Do not call
    // res.setHeader() here; doing so causes ERR_HTTP_HEADERS_SENT and can
    // terminate the Vercel function after an otherwise successful response.

    if (durationMs >= SLOW_REQUEST_MS && process.env.NODE_ENV !== 'test') {
      console.warn(`[SLOW] ${routeKey} ${status} ${durationMs.toFixed(1)}ms`);
    }
  });

  next();
});

// JSON-only API parser with an intentionally small body ceiling.
app.use(express.json({
  limit: process.env.JSON_BODY_LIMIT || '100kb',
  strict: true,
  type: ['application/json', 'application/*+json']
}));

// Reject non-JSON mutation payloads before they reach domain handlers.
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    if (!contentType.startsWith('application/json') && req.path !== '/cron/notifications') {
      return res.status(415).json({ error: 'Content-Type must be application/json' });
    }
  }
  next();
});

// Basic request-shape limits. These protect the parser and downstream business
// logic without mutating domain payloads.
function validateRequestShape(req, res, next) {
  const body = req.body;
  const query = req.query || {};
  const params = req.params || {};

  if (body !== undefined && body !== null && typeof body !== 'object') {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }

  const stack = [body, query, params];
  let nodes = 0;
  while (stack.length) {
    const value = stack.pop();
    if (value === null || value === undefined) continue;
    nodes++;
    if (nodes > 2000) return res.status(400).json({ error: 'Request payload is too complex' });

    if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) {
      return res.status(400).json({ error: 'Request contains an oversized string' });
    }

    if (Array.isArray(value)) {
      if (value.length > MAX_ARRAY_ITEMS) {
        return res.status(400).json({ error: 'Request contains too many array items' });
      }
      for (const item of value) stack.push(item);
    } else if (typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length > 100) return res.status(400).json({ error: 'Request contains too many fields' });
      for (const key of keys) {
        if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
          return res.status(400).json({ error: 'Invalid request field' });
        }
        stack.push(value[key]);
      }
    }
  }
  next();
}
app.use('/api', validateRequestShape);
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html for browser/app routes, but never swallow API or
// operational health endpoints. The health routes are declared later in this
// file, so they must reach those handlers instead of this SPA fallback.
const operationalPaths = new Set(['/health', '/health/ready', '/health/metrics']);
app.get('*', (req, res, next) => {
if (!req.path.startsWith('/api/') && !operationalPaths.has(req.path)) {
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
sessionVersion: { type: Number, default: 0, min: 0 },
subscriptionPlan: { type: String, enum: ['free', 'plus'], default: 'free' },
subscriptionStatus: { type: String, enum: ['active', 'past_due', 'cancelled', 'trialing'], default: 'active' },
subscriptionUpdatedAt: { type: Date },
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

vaultSchema.index({ userId: 1, createdAt: 1 });
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
goalSchema.index({ userId: 1, vaultId: 1 });
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
pushSubscriptionSchema.index({ userId: 1, endpoint: 1 });
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
  event: { type: String, enum: ['goal_at_risk','expense_threshold','habit_streak','weekly_summary','financial_health_drop','savings_rate_below','habit_finance_signal'], required: true },
  condition: { type: mongoose.Schema.Types.Mixed, default: {} },
  action: { type: String, enum: ['push','in_app'], default: 'push' },
  enabled: { type: Boolean, default: true },
  lastTriggeredAt: { type: Date, default: null }
}, { timestamps: true });
automationRuleSchema.index({ userId: 1, enabled: 1, event: 1 });
automationRuleSchema.index({ _id: 1, userId: 1 });
const AutomationRule = mongoose.model('AutomationRule', automationRuleSchema);

const mutationReceiptSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  key: { type: String, required: true, maxlength: 160 },
  type: { type: String, required: true, maxlength: 80 },
  status: { type: String, enum: ['processing', 'completed'], default: 'processing', index: true },
  processingUntil: { type: Date, default: null, index: true },
  result: { type: mongoose.Schema.Types.Mixed, default: null }
}, { timestamps: true });
mutationReceiptSchema.index({ userId: 1, key: 1 }, { unique: true });
mutationReceiptSchema.index({ userId: 1, status: 1, processingUntil: 1 });
const MutationReceipt = mongoose.model('MutationReceipt', mutationReceiptSchema);

// One durable claim per automation evaluation key. This closes the race where
// two scheduler invocations evaluate the same rule before lastTriggeredAt moves.
const automationTriggerSchema = new mongoose.Schema({
  ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'AutomationRule', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  key: { type: String, required: true, maxlength: 180 },
  status: { type: String, enum: ['processing', 'sent', 'failed'], default: 'processing', index: true },
  processingUntil: { type: Date, default: null, index: true },
  error: { type: String, maxlength: 500, default: null }
}, { timestamps: true });
automationTriggerSchema.index({ ruleId: 1, key: 1 }, { unique: true });
automationTriggerSchema.index({ userId: 1, createdAt: -1 });
const AutomationTrigger = mongoose.model('AutomationTrigger', automationTriggerSchema);



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

// Authentication / session contract.
// JWT proves the token was issued by VaultFlow; the User lookup proves the
// account is still active and the session has not been revoked.
function issueAccessToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error('Server authentication is not configured');
  }

  const sessionVersion = Number(user.sessionVersion || 0);
  const userId = String(user._id);

  return jwt.sign(
    {
      sub: userId,
      userId,
      username: user.username,
      sessionVersion
    },
    process.env.JWT_SECRET,
    {
      expiresIn: AUTH_TOKEN_TTL,
      algorithm: JWT_ALGORITHM,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      jwtid: crypto.randomUUID()
    }
  );
}

const authenticateToken = async (req, res, next) => {
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

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    });

    if (!payload || !payload.userId || !payload.sub || String(payload.userId) !== String(payload.sub)) {
      return res.status(401).json({ error: 'Invalid token subject' });
    }

    const user = await User.findById(payload.userId)
      .select('_id username email sessionVersion')
      .lean();

    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const tokenVersion = Number(payload.sessionVersion);
    const currentVersion = Number(user.sessionVersion || 0);

    // Missing sessionVersion intentionally invalidates tokens issued before
    // Phase 4H-2. This provides a clean security migration on deployment.
    if (!Number.isInteger(tokenVersion) || tokenVersion !== currentVersion) {
      return res.status(401).json({ error: 'Session revoked. Please login again.' });
    }

    req.user = {
      userId: user._id,
      username: user.username,
      email: user.email,
      sessionVersion: currentVersion
    };
    next();
  } catch (error) {
    if (error?.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
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
  try {
    await NotificationDelivery.create({
      userId,
      subscriptionId,
      key,
      status: 'sent'
    });
    return true;
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }

  // A previous delivery attempt may have failed after claiming the unique key.
  // Atomically reclaim only failed deliveries so concurrent cron invocations
  // cannot both resend the same notification.
  const reclaimed = await NotificationDelivery.findOneAndUpdate(
    {
      userId,
      subscriptionId,
      key,
      status: 'failed'
    },
    {
      $set: {
        status: 'sent',
        sentAt: new Date()
      }
    },
    { new: true }
  ).lean();

  return Boolean(reclaimed);
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

async function claimAutomationTrigger(rule, key, now = new Date()) {
  const leaseUntil = new Date(now.getTime() + 2 * 60 * 1000);
  try {
    const created = await AutomationTrigger.create({
      ruleId: rule._id,
      userId: rule.userId,
      key,
      status: 'processing',
      processingUntil: leaseUntil
    });
    return { claimed: true, trigger: created.toObject() };
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }

  const existing = await AutomationTrigger.findOne({ ruleId: rule._id, key }).lean();
  if (!existing) return { claimed: false, reason: 'RACE_RETRY' };
  if (existing.status === 'sent') return { claimed: false, reason: 'ALREADY_SENT' };

  const expired = !existing.processingUntil || new Date(existing.processingUntil) <= now;
  if (!expired) return { claimed: false, reason: 'ALREADY_PROCESSING' };

  const reclaimed = await AutomationTrigger.findOneAndUpdate(
    {
      _id: existing._id,
      status: { $in: ['processing', 'failed'] },
      $or: [{ processingUntil: null }, { processingUntil: { $lte: now } }]
    },
    { $set: { status: 'processing', processingUntil: leaseUntil, error: null } },
    { new: true }
  ).lean();

  return reclaimed
    ? { claimed: true, trigger: reclaimed }
    : { claimed: false, reason: 'ALREADY_PROCESSING' };
}

async function completeAutomationTrigger(triggerId) {
  await AutomationTrigger.updateOne(
    { _id: triggerId, status: 'processing' },
    { $set: { status: 'sent', processingUntil: null, error: null } }
  );
}

async function failAutomationTrigger(triggerId, error) {
  await AutomationTrigger.updateOne(
    { _id: triggerId, status: 'processing' },
    { $set: { status: 'failed', processingUntil: null, error: String(error?.message || 'Automation delivery failed').slice(0, 500) } }
  );
}

function getAutomationOccurrenceKey(rule, now, context = {}) {
  const dateKey = now.toISOString().slice(0, 10);
  if (rule.event === 'weekly_summary') {
    const year = now.getUTCFullYear();
    const firstDay = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil((((now - firstDay) / 86400000) + firstDay.getUTCDay() + 1) / 7);
    return `automation:${rule._id}:week:${year}-${week}`;
  }
  if (rule.event === 'habit_streak' && context.habitId) {
    return `automation:${rule._id}:habit:${context.habitId}:${dateKey}`;
  }
  if (rule.event === 'habit_finance_signal') {
    return `automation:${rule._id}:habit-finance:${dateKey}`;
  }
  return `automation:${rule._id}:${dateKey}`;
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
      let occurrenceContext = {};
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
          if (streak >= threshold) { shouldTrigger = true; occurrenceContext = { habitId: habit._id }; title = `${habit.name}: ${streak} day streak`; body = `You reached the streak threshold of ${threshold} days.`; break; }
        }
      } else if (rule.event === 'weekly_summary') {
        shouldTrigger = now.getUTCDay() === 0 && now.getUTCHours() >= 18;
        body = `Savings rate ${financial.totals.savingsRate}%, habit completion ${habits.overallCompletionRate}%.`;
      } else if (rule.event === 'financial_health_drop') {
        const threshold = Math.max(0, Math.min(100, Number(rule.condition?.threshold ?? 50)));
        const score = Number(financial.health?.score || 0);
        shouldTrigger = score <= threshold;
        if (shouldTrigger) body = `Financial health is currently ${Math.round(score)}/100, at or below your ${threshold} threshold.`;
      } else if (rule.event === 'savings_rate_below') {
        const threshold = Number(rule.condition?.threshold ?? 10);
        const rate = Number(financial.totals?.savingsRate || 0);
        shouldTrigger = threshold >= 0 && rate <= threshold;
        if (shouldTrigger) body = `Your savings rate is currently ${rate.toFixed(1)}%, at or below your ${threshold}% threshold.`;
      } else if (rule.event === 'habit_finance_signal') {
        const threshold = Number(rule.condition?.threshold ?? 10);
        const fh = calculateFinanceHabitCorrelation(snapshot.transactions, snapshot.habits, snapshot.habitLogs, now);
        const difference = fh.spendingDifferencePercent;
        shouldTrigger = fh.observedDays >= 7 && difference != null && Math.abs(Number(difference)) >= threshold;
        if (shouldTrigger) body = `Habit completion and spending differ by ${Math.abs(Number(difference))}% across observed days.`;
      }
      if (!shouldTrigger) continue;
      if (rule.lastTriggeredAt && (now - new Date(rule.lastTriggeredAt)) < 20 * 60 * 1000) continue;
      const subs = rule.action === 'push'
        ? await PushSubscription.find({ userId: rule.userId }).lean()
        : [];
      const key = getAutomationOccurrenceKey(rule, now, occurrenceContext);
      const claim = await claimAutomationTrigger(rule, key, now);
      if (!claim.claimed) continue;

      let delivered = rule.action === 'in_app';
      try {
        for (const sub of subs) {
          const result = await sendBackgroundPush(
            sub,
            { title, body, data:{ page:'insights', tag:key, urgency:'normal' } },
            key
          );
          if (result.sent) delivered = true;
        }

        if (delivered) {
          await completeAutomationTrigger(claim.trigger._id);
          await AutomationRule.updateOne(
            { _id: rule._id, $or: [{ lastTriggeredAt: null }, { lastTriggeredAt: { $lt: now } }] },
            { $set: { lastTriggeredAt: now } }
          );
          triggered++;
        } else {
          await failAutomationTrigger(claim.trigger._id, new Error('No notification was delivered'));
        }
      } catch (deliveryError) {
        await failAutomationTrigger(claim.trigger._id, deliveryError);
        throw deliveryError;
      }
    } catch (error) {
      console.error('[Automation] rule evaluation failed:', rule._id, error.message);
    }
  }
  return { triggered };
}

async function runBackgroundNotificationJob(now = new Date()) {
  const startedAt = new Date(now);
  console.log(`[NotificationCron] started ${startedAt.toISOString()}`);

  if (!pushConfigured()) {
    console.log(`[NotificationCron] finished ${new Date().toISOString()} configured=false sent=0 checked=0 reason=VAPID_NOT_CONFIGURED`);
    return { configured: false, sent: 0, checked: 0, skipped: 'VAPID_NOT_CONFIGURED' };
  }

  const subscriptions = await PushSubscription.find({}).lean().maxTimeMS(15000);
  let sent = 0;
  let checked = 0;
  let skipped = 0;
  let failed = 0;

  // Finance notifications deliberately use the same 18:00 local-time window as
  // the existing client-side notification contract. The job is minute-driven,
  // but each notification has a deterministic per-day/per-week delivery key.
  const financeHour = 18;

  // Cache per-user data so multiple browser/device subscriptions do not cause
  // repeated MongoDB reads for the same user during a single cron execution.
  const userContext = new Map();

  async function getUserNotificationContext(userId) {
    const id = String(userId);
    if (userContext.has(id)) return userContext.get(id);

    const [settings, transactions, habits, logs] = await Promise.all([
      NotificationSettings.findOne({ userId }).lean(),
      Transaction.find({ userId }).lean(),
      Habit.find({ userId, status: 'active' }).lean(),
      HabitLog.find({ userId, scheduledDate: { $gte: addDaysLocalDate(getTimeZoneParts(now, 'UTC').year + '-' + getTimeZoneParts(now, 'UTC').month + '-' + getTimeZoneParts(now, 'UTC').day, -370), $lte: getTimeZoneParts(now, 'UTC').year + '-' + getTimeZoneParts(now, 'UTC').month + '-' + getTimeZoneParts(now, 'UTC').day } }).lean()
    ]);

    const context = { settings, transactions, habits, logs };
    userContext.set(id, context);
    return context;
  }

  try {
    for (const sub of subscriptions) {
      checked++;
      try {
        const parts = getTimeZoneParts(now, sub.timezone || 'UTC');
        const today = localDateFromParts(parts);
        const context = await getUserNotificationContext(sub.userId);
        const settings = context.settings;

        if (!settings?.enabled) {
          skipped++;
          continue;
        }

        // ------------------------------------------------------------
        // Finance: daily tracking reminder
        // ------------------------------------------------------------
        if (settings.dailyReminder && parts.hour >= financeHour) {
          const key = `finance-daily:${today}`;
          const result = await sendBackgroundPush(
            sub,
            {
              title: 'Track today in VaultFlow',
              body: 'A quick expense update now keeps your weekly insights accurate.',
              data: { page: 'transactions', tag: key, urgency: 'normal' }
            },
            key
          );
          if (result.sent) sent++;
          else if (result.skipped === 'ALREADY_SENT') skipped++;
          else if (result.skipped) skipped++;
          else if (!result.gone) failed++;
        }

        // ------------------------------------------------------------
        // Finance: weekly money summary
        // Sunday after 18:00 in the subscription timezone.
        // ------------------------------------------------------------
        if (settings.weeklySummary && parts.weekday === 'Sun' && parts.hour >= financeHour) {
          const income = context.transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + Number(t.amount || 0), 0);
          const expense = context.transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Number(t.amount || 0), 0);
          const savings = Math.max(0, income - expense);
          const byCategory = {};
          context.transactions
            .filter(t => t.type === 'expense')
            .forEach(t => {
              const category = t.category || 'Other';
              byCategory[category] = (byCategory[category] || 0) + Number(t.amount || 0);
            });
          const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
          const body = topCategory
            ? `Top expense: ${topCategory[0]}. Savings so far: ${Number(savings).toFixed(2)}.`
            : `Savings so far: ${Number(savings).toFixed(2)}.`;
          const key = `finance-weekly:${today}`;
          const result = await sendBackgroundPush(
            sub,
            {
              title: 'Your weekly money snapshot',
              body,
              data: { page: 'reports', tag: key, urgency: 'low' }
            },
            key
          );
          if (result.sent) sent++;
          else if (result.skipped) skipped++;
          else if (!result.gone) failed++;
        }

        // ------------------------------------------------------------
        // Finance: savings insight
        // Sent once per local day, in the same evening window as the
        // daily/weekly finance notifications, only when there is positive
        // savings and income to calculate a meaningful rate.
        // ------------------------------------------------------------
        if (settings.savingsInsights && parts.hour >= financeHour) {
          const totalIncome = context.transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + Number(t.amount || 0), 0);
          const totalExpense = context.transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Number(t.amount || 0), 0);
          const savings = Math.max(0, totalIncome - totalExpense);
          if (savings > 0 && totalIncome > 0) {
            const rate = ((savings / totalIncome) * 100).toFixed(1);
            const key = `finance-savings:${today}`;
            const result = await sendBackgroundPush(
              sub,
              {
                title: 'Nice progress this period',
                body: `You are saving ${rate}% of your income.`,
                data: { page: 'dashboard', tag: key, urgency: 'low' }
              },
              key
            );
            if (result.sent) sent++;
            else if (result.skipped) skipped++;
            else if (!result.gone) failed++;
          }
        }

        // ------------------------------------------------------------
        // Habits
        // ------------------------------------------------------------
        const habits = context.habits;
        const logs = context.logs;

        if (settings.habitReminder) {
          for (const habit of habits) {
            if (!habit.reminder?.enabled || !habit.reminder.time || !isHabitScheduledOnServer(habit, today)) continue;
            const [hh, mm] = habit.reminder.time.split(':').map(Number);
            if (parts.hour * 60 + parts.minute < hh * 60 + mm) continue;
            if (await getHabitStatusForDate(habit._id, today, logs) === 'completed') continue;

            const key = `habit-reminder:${today}:${habit._id}`;
            const result = await sendBackgroundPush(
              sub,
              {
                title: `Habit reminder: ${habit.name}`,
                body: 'Your scheduled habit is still pending.',
                data: { page: 'habits', habitId: String(habit._id), date: today, tag: key, urgency: 'normal' }
              },
              key
            );
            if (result.sent) sent++;
            else if (result.skipped) skipped++;
            else if (!result.gone) failed++;
          }
        }

        if (settings.habitRisk) {
          for (const habit of habits) {
            if (!isHabitScheduledOnServer(habit, today)) continue;
            if (await getHabitStatusForDate(habit._id, today, logs) !== 'pending') continue;
            const streak = await getCurrentHabitStreakServer(habit, today, logs);
            if (streak < 2) continue;

            const key = `habit-risk:${today}:${habit._id}`;
            const result = await sendBackgroundPush(
              sub,
              {
                title: `Protect your ${streak} day streak`,
                body: `${habit.name} is still pending today.`,
                data: { page: 'habits', habitId: String(habit._id), date: today, tag: key, urgency: 'normal' }
              },
              key
            );
            if (result.sent) sent++;
            else if (result.skipped) skipped++;
            else if (!result.gone) failed++;
          }
        }

        if (settings.habitWeeklySummary && parts.weekday === 'Sun' && parts.hour >= financeHour) {
          const from = addDaysLocalDate(today, -6);
          const completed = await HabitLog.countDocuments({
            userId: sub.userId,
            status: 'completed',
            scheduledDate: { $gte: from, $lte: today }
          });
          let scheduledCount = 0;
          for (const habit of habits) {
            let d = from;
            for (let i = 0; i < 7; i++) {
              if (isHabitScheduledOnServer(habit, d)) scheduledCount++;
              d = addDaysLocalDate(d, 1);
            }
          }
          if (scheduledCount > 0) {
            const rate = Math.round((completed / Math.max(1, scheduledCount)) * 100);
            const key = `habit-weekly:${today}`;
            const result = await sendBackgroundPush(
              sub,
              {
                title: 'Your weekly habit review',
                body: `${rate}% completion across your scheduled habits this week.`,
                data: { page: 'habits', tag: key, urgency: 'low' }
              },
              key
            );
            if (result.sent) sent++;
            else if (result.skipped) skipped++;
            else if (!result.gone) failed++;
          }
        }
      } catch (subscriptionError) {
        failed++;
        console.error('[NotificationCron] subscription failed', {
          subscriptionId: String(sub._id),
          error: subscriptionError?.message || String(subscriptionError)
        });
      }
    }

    const result = { configured: true, checked, sent, skipped, failed };
    console.log(`[NotificationCron] finished ${new Date().toISOString()} configured=true checked=${checked} sent=${sent} skipped=${skipped} failed=${failed}`);
    return result;
  } catch (error) {
    console.error(`[NotificationCron] failed ${new Date().toISOString()}`, error);
    throw error;
  }
}

// ============================================
// AUTHENTICATION ROUTES
// ============================================
// Lightweight per-process limiter. For multi-instance/serverless production,
// replace this store with a shared Redis/Upstash implementation using the same
// contract. The API remains fail-closed only for malformed configuration.
const rateLimitMap = new Map();
const RATE_LIMIT_MAX_KEYS = 10000;

function consumeRateLimit(key, max, windowMs) {
  const now = Date.now();
  let entry = rateLimitMap.get(key);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
  }

  entry.count += 1;
  rateLimitMap.set(key, entry);

  if (rateLimitMap.size > RATE_LIMIT_MAX_KEYS) {
    for (const [k, v] of rateLimitMap) {
      if (now >= v.resetAt) rateLimitMap.delete(k);
      if (rateLimitMap.size <= RATE_LIMIT_MAX_KEYS * 0.8) break;
    }
  }

  return {
    limited: entry.count > max,
    remaining: Math.max(0, max - entry.count),
    resetAt: entry.resetAt
  };
}

function getRateLimitIdentity(req, scope) {
  const userId = req.user?.userId ? String(req.user.userId) : null;
  const ip = String(req.ip || req.socket?.remoteAddress || 'unknown');
  return `${scope}:${userId || `ip:${ip}`}`;
}

function apiRateLimit(req, res, next) {
  const result = consumeRateLimit(
    getRateLimitIdentity(req, 'api'),
    API_RATE_LIMIT_MAX,
    API_RATE_LIMIT_WINDOW_MS
  );
  res.setHeader('X-RateLimit-Limit', API_RATE_LIMIT_MAX);
  res.setHeader('X-RateLimit-Remaining', result.remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));
  if (result.limited) {
    res.setHeader('Retry-After', Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)));
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }
  next();
}

function isRateLimited(key, max = 5, windowMs = 15 * 60 * 1000) {
  return consumeRateLimit(`sensitive:${key}`, max, windowMs).limited;
}

function isAuthRateLimited(key, max = AUTH_RATE_LIMIT_MAX, windowMs = AUTH_RATE_LIMIT_WINDOW_MS) {
  return consumeRateLimit(`auth:${key}`, max, windowMs).limited;
}

// Global API limiter. Authentication routes additionally receive endpoint-specific
// limits below.
app.use('/api', apiRateLimit);

// Register
app.get('/api/account/plan', ensureConnection, authenticateToken, async (req, res) => {
  try {
    await connectToDatabase();
    const user = await User.findById(req.user.userId)
      .select('subscriptionPlan subscriptionStatus subscriptionUpdatedAt')
      .lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ plan: buildPlanProfile(user) });
  } catch (error) {
    console.error('Account plan error:', error);
    res.status(500).json({ error: 'Failed to load plan' });
  }
});

app.post('/api/auth/register', ensureConnection, async (req, res, next) => {
try {
const { username, email, password } = req.body || {};
const registerKey = `${req.ip}:${String(email || '').trim().toLowerCase()}`;
if (isAuthRateLimited(registerKey, 8)) {
return res.status(429).json({ error: 'Too many registration attempts. Please try again later.' });
}
if (!username || !email || !password || typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
return res.status(400).json({ error: 'Username, email and password required' });
}
if (username.length > 64 || email.length > 254) {
return res.status(400).json({ error: 'Username or email is too long' });
}
if (password.length < 8 || password.length > 128 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
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

const token = issueAccessToken(user);

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
app.post('/api/auth/login', ensureConnection, async (req, res, next) => {
try {
const { username, password } = req.body || {};
const identifier = typeof username === 'string' ? username.trim().toLowerCase() : '';
if (isAuthRateLimited(`${req.ip}:${identifier}`, 10)) {
return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
}
if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
return res.status(400).json({ error: 'Username and password required' });
}
if (username.length > 254 || password.length > 128) {
return res.status(400).json({ error: 'Credentials are too long' });
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

const token = issueAccessToken(user);

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


// Logout / server-side session revocation.
app.post('/api/auth/logout', ensureConnection, authenticateToken, async (req, res) => {
try {
  const updated = await User.findOneAndUpdate(
    { _id: req.user.userId, sessionVersion: req.user.sessionVersion },
    { $inc: { sessionVersion: 1 } },
    { new: true }
  ).select('_id sessionVersion').lean();

  if (!updated) return res.status(401).json({ error: 'Invalid or expired session' });
  res.json({ success: true });
} catch (error) {
  console.error('Logout error:', error);
  res.status(500).json({ error: 'Server error during logout' });
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

const resetOrigin = PUBLIC_APP_URL || `${req.protocol}://${req.get('host')}`;
const resetUrl = `${resetOrigin}/reset-password?token=${rawToken}`;
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
if (password.length < 8 || password.length > 128 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
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
user.sessionVersion = Number(user.sessionVersion || 0) + 1;
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
const transactionQuery = Transaction.find({ userId }).lean().maxTimeMS(10000);
const vaultQuery = Vault.find({ userId }).lean().maxTimeMS(10000);
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

if (!vaults.length) return totals;

await Promise.all(vaults.map(async (vault) => {
const bucket = totals.get(String(vault._id));
const totalIncome = bucket?.totalIncome || 0;
const totalSpent = bucket?.totalSpent || 0;

const query = Vault.updateOne(
{ _id: vault._id, userId },
{
$set: {
totalIncome,
totalSpent,
balance: totalIncome - totalSpent
}
}
).maxTimeMS(10000);

if (session) query.session(session);
await query.exec();
}));

return totals;
}

async function runFinancialMutation(work) {
const session = await mongoose.startSession();
try {
let result;
await session.withTransaction(
  async () => {
    result = await work(session);
  },
  {
    readConcern: { level: 'snapshot' },
    writeConcern: { w: 'majority' },
    maxCommitTimeMS: 10000
  }
);
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
  const [transactions, vaults, goals, habits, habitLogs, automationRules] = await Promise.all([
    Transaction.find({ userId }).lean(),
    Vault.find({ userId }).lean(),
    Goal.find({ userId }).lean(),
    Habit.find({ userId }).lean(),
    HabitLog.find({ userId }).lean(),
    AutomationRule.find({ userId }).lean()
  ]);
  return { transactions, vaults, goals, habits, habitLogs, automationRules };
}

async function claimMutationReceipt(userId, key, type, session = null) {
  if (!key || typeof key !== 'string' || key.length > 160) return null;
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + 2 * 60 * 1000);

  const query = MutationReceipt.findOneAndUpdate(
    {
      userId,
      key,
      $or: [
        { status: 'completed' },
        { status: 'processing', processingUntil: { $gt: now } },
        { status: 'processing', processingUntil: { $lte: now } },
        { status: { $exists: false } }
      ]
    },
    { $setOnInsert: { userId, key, type, status: 'processing', processingUntil: leaseUntil } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  if (session) query.session(session);

  try {
    const receipt = await query.lean();
    if (!receipt) return null;
    if (receipt.status === 'completed') return receipt;
    if (receipt.status === 'processing' && receipt.processingUntil && new Date(receipt.processingUntil) > now) {
      return receipt;
    }

    const reclaim = MutationReceipt.findOneAndUpdate(
      { userId, key, status: 'processing', processingUntil: { $lte: now } },
      { $set: { type, processingUntil: leaseUntil, error: null } },
      { new: true }
    );
    if (session) reclaim.session(session);
    return await reclaim.lean();
  } catch (error) {
    if (error?.code === 11000) return MutationReceipt.findOne({ userId, key }).lean();
    throw error;
  }
}

async function completeMutationReceipt(userId, key, result, session = null) {
  const query = MutationReceipt.updateOne(
    { userId, key, status: 'processing' },
    { $set: { status: 'completed', processingUntil: null, result } }
  );
  if (session) query.session(session);
  await query;
}

async function releaseMutationReceipt(userId, key, errorMessage, session = null) {
  const query = MutationReceipt.deleteOne({ userId, key, status: 'processing' });
  if (session) query.session(session);
  await query;
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
// Phase 9B-R1: keep the transaction endpoint serverless-safe.
// The previous implementation wrapped the entire mutation + balance rebuild
// in a MongoDB session transaction. That path could remain pending in Vercel
// until FUNCTION_INVOCATION_TIMEOUT. This endpoint now uses short, bounded
// writes and a deterministic balance rebuild; ownership remains enforced by
// req.user.userId on every resource query/write.
app.post('/api/transactions', ensureConnection, authenticateToken, async (req, res) => {
const startedAt = Date.now();
try {
const { date, time, type, amount, category, location, wallet, paymentMethod, vaultId, notes } = req.body;
const normalizedAmount = normalizeAmount(amount);

if (!date || !type || !normalizedAmount || !category) {
return res.status(400).json({ error: 'Date, type, amount, and category required' });
}

console.log(`[Transaction] create:start type=${type} amount=${normalizedAmount}`);

const ownedVault = await assertOwnedVault(req.user.userId, vaultId || null);
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

await created.save();
console.log(`[Transaction] create:saved id=${created._id} elapsedMs=${Date.now() - startedAt}`);

let balancesRebuilt = true;
try {
await rebuildVaultBalances(req.user.userId);
} catch (balanceError) {
balancesRebuilt = false;
console.error(`[Transaction] create:balance-rebuild-failed id=${created._id}`, balanceError);
}

console.log(`[Transaction] create:complete id=${created._id} balancesRebuilt=${balancesRebuilt} elapsedMs=${Date.now() - startedAt}`);
res.status(201).json({
...created.toObject(),
balancesRebuilt
});

} catch (error) {
console.error(`[Transaction] create:error elapsedMs=${Date.now() - startedAt}`, error);
if (error.statusCode === 404) {
return res.status(404).json({ error: 'Vault not found' });
}
res.status(500).json({ error: 'Server error creating transaction' });
}
});


// Update transaction
app.put('/api/transactions/:id', ensureConnection, authenticateToken, async (req, res) => {
const startedAt = Date.now();
try {
const { date, time, type, amount, category, location, wallet, paymentMethod, vaultId, notes } = req.body;
const normalizedAmount = normalizeAmount(amount);

if (!date || !type || !normalizedAmount || !category) {
return res.status(400).json({ error: 'Date, type, amount, and category required' });
}

const ownedVault = await assertOwnedVault(req.user.userId, vaultId || null);
const oldTransaction = await Transaction.findOne({
_id: req.params.id,
userId: req.user.userId
}).maxTimeMS(10000).lean();

if (!oldTransaction) {
return res.status(404).json({ error: 'Transaction not found' });
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
{ new: true, runValidators: true, maxTimeMS: 10000 }
).lean();

if (!updated) {
return res.status(404).json({ error: 'Transaction not found' });
}

let balancesRebuilt = true;
try {
await rebuildVaultBalances(req.user.userId);
} catch (balanceError) {
balancesRebuilt = false;
console.error(`[Transaction] update:balance-rebuild-failed id=${req.params.id}`, balanceError);
}

console.log(`[Transaction] update:complete id=${req.params.id} balancesRebuilt=${balancesRebuilt} elapsedMs=${Date.now() - startedAt}`);
res.json({ ...updated, balancesRebuilt });

} catch (error) {
console.error(`[Transaction] update:error id=${req.params.id} elapsedMs=${Date.now() - startedAt}`, error);
if (error.statusCode === 404) {
return res.status(404).json({ error: 'Vault not found' });
}
res.status(500).json({ error: 'Server error updating transaction' });
}
});

// Delete transaction
app.delete('/api/transactions/:id', ensureConnection, authenticateToken, async (req, res) => {
const startedAt = Date.now();
try {
const deleted = await Transaction.findOneAndDelete({
_id: req.params.id,
userId: req.user.userId
}, { maxTimeMS: 10000 }).lean();

if (!deleted) {
return res.status(404).json({ error: 'Transaction not found' });
}

let balancesRebuilt = true;
try {
await rebuildVaultBalances(req.user.userId);
} catch (balanceError) {
balancesRebuilt = false;
console.error(`[Transaction] delete:balance-rebuild-failed id=${req.params.id}`, balanceError);
}

console.log(`[Transaction] delete:complete id=${req.params.id} balancesRebuilt=${balancesRebuilt} elapsedMs=${Date.now() - startedAt}`);
res.json({ message: 'Transaction deleted successfully', balancesRebuilt });

} catch (error) {
console.error(`[Transaction] delete:error id=${req.params.id} elapsedMs=${Date.now() - startedAt}`, error);
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
    const financeHabit = calculateFinanceHabitCorrelation(snapshot.transactions, snapshot.habits, snapshot.habitLogs);
    const personalization = buildPersonalizationProfile(financial, projections, habits, financeHabit);
    const retention = buildRetentionProfile(snapshot.transactions, snapshot.goals, snapshot.habits, snapshot.habitLogs, personalization);
    const plan = buildPlanProfile(req.user || {});
    const insights = buildInsights(financial, projections, habits, recurring, financeHabit);
    // Phase 5F contract: retention, insights remain part of the authenticated intelligence response.
    res.json({ financial, goals: projections, habits, recurring, financeHabit, personalization, insights, retention, plan });
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
    const now = new Date();
    const financial = calculateFinancialIntelligence(snapshot.transactions, now);
    const habits = calculateHabitSnapshot(snapshot.habits, snapshot.habitLogs, now);
    const financeHabit = calculateFinanceHabitCorrelation(snapshot.transactions, snapshot.habits, snapshot.habitLogs, now);
    const intelligence = { ...financial, financeHabit, habits };
    res.json({ query, results: searchAll(query, { ...snapshot, intelligence }) });
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
    const allowed = ['goal_at_risk','expense_threshold','habit_streak','weekly_summary','financial_health_drop','savings_rate_below','habit_finance_signal'];
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
    if (update.event && !['goal_at_risk','expense_threshold','habit_streak','weekly_summary','financial_health_drop','savings_rate_below','habit_finance_signal'].includes(update.event)) {
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
      const key = String(mutation?.key || '').trim();
      const type = String(mutation?.type || '').trim();

      if (!key || !type || key.length > 160 || type.length > 80) {
        results.push({ key, status: 'rejected', error: 'Invalid mutation key/type' });
        continue;
      }

      try {
        let finalResult = null;
        let outcome = 'applied';

        await runFinancialMutation(async (session) => {
          const receipt = await claimMutationReceipt(req.user.userId, key, type, session);

          if (receipt?.status === 'completed') {
            finalResult = receipt.result;
            outcome = 'already-applied';
            return;
          }

          if (receipt?.status === 'processing' && receipt.processingUntil && new Date(receipt.processingUntil) > new Date()) {
            const error = new Error('Mutation is already being processed');
            error.statusCode = 409;
            throw error;
          }

          let result;
          if (type === 'habit_log_create') {
            const habit = await Habit.findOne({
              _id: mutation.payload?.habitId,
              userId: req.user.userId
            }).session(session).lean();

            if (!habit) throw Object.assign(new Error('Habit not found'), { statusCode: 404 });

            result = await HabitLog.findOneAndUpdate(
              {
                userId: req.user.userId,
                habitId: habit._id,
                scheduledDate: mutation.payload.scheduledDate
              },
              {
                $set: {
                  status: mutation.payload.status || 'completed',
                  note: mutation.payload.note || ''
                }
              },
              {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true,
                session
              }
            ).lean();
          } else if (type === 'transaction_create') {
            const payload = mutation.payload || {};
            const ownedVault = await assertOwnedVault(req.user.userId, payload.vaultId || null, session);

            const created = await Transaction.create([{
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
            }], { session });

            result = created[0].toObject();
            await rebuildVaultBalances(req.user.userId, session);
          } else {
            throw Object.assign(new Error('Unsupported mutation type'), { statusCode: 400 });
          }

          finalResult = result;
          await completeMutationReceipt(req.user.userId, key, result, session);
        });

        results.push({ key, status: outcome, result: finalResult });
      } catch (error) {
        if (error?.statusCode === 409 && error.message === 'Mutation is already being processed') {
          results.push({ key, status: 'already-processing', error: error.message });
        } else {
          // The domain mutation and receipt claim are in the same transaction,
          // so a failed mutation cannot leave a completed receipt behind.
          results.push({ key, status: 'failed', error: error.message });
        }
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

// Health / release metadata. Keep this endpoint non-sensitive: never expose
// connection strings, JWT secrets, mail credentials, or private VAPID material.
app.get('/health', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    status: 'ok',
    service: 'vaultflow-api',
    version: RELEASE_VERSION,
    commit: RELEASE_COMMIT,
    environment: process.env.NODE_ENV || 'development',
    node: process.version
  });
});

app.get('/health/ready', async (req, res) => {
  try {
    await connectToDatabase();
    const ready = mongoose.connection.readyState === 1;
    if (!ready) return res.status(503).json({ status: 'not_ready', database: 'disconnected' });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      status: 'ready',
      service: 'vaultflow-api',
      version: RELEASE_VERSION,
      database: 'connected'
    });
  } catch (error) {
    console.error('[READINESS] Database check failed:', error?.message || error);
    return res.status(503).json({ status: 'not_ready', database: 'error' });
  }
});

// Internal aggregate diagnostics. Disabled unless explicitly enabled.
// No request bodies, tokens, emails, IPs, or database contents are exposed.
app.get('/health/metrics', (req, res) => {
  if (process.env.OBSERVABILITY_ENABLED !== '1') {
    return res.status(404).json({ error: 'Not found' });
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.json({
    status: 'ok',
    service: 'vaultflow-api',
    version: RELEASE_VERSION,
    commit: RELEASE_COMMIT,
    environment: process.env.NODE_ENV || 'development',
    metrics: getRuntimeMetrics()
  });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3000;

// Final API error normalization. Keep API failures JSON-shaped in both
// staging and production so parser/CORS errors never fall through to
// Express's default HTML/stack-trace error handler.
app.use((error, req, res, next) => {
  if (error?.type === 'entity.too.large' || error?.status === 413) {
    return res.status(413).json({ error: 'Request payload is too large' });
  }
  if (error instanceof SyntaxError && error?.status === 400 && 'body' in error) {
    return res.status(400).json({ error: 'Malformed JSON payload' });
  }
  if (error?.message === 'CORS origin not allowed') {
    return res.status(403).json({ error: 'CORS origin not allowed' });
  }
  recordRuntimeError(error, req);
  console.error('[API] Unhandled error:', error?.message || error);
  if (res.headersSent) return next(error);
  return res.status(500).json({ error: 'Internal server error' });
});

if (process.env.NODE_ENV !== 'production') {
app.listen(PORT, () => {
console.log(`🚀 VaultFlow server running on port ${PORT}`);
});
}

// Export for Vercel
module.exports = app;
