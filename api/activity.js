/**
 * VaultFlow Personal OS — daily activity aggregation (OS2).
 * GET /api/activity?date=YYYY-MM-DD
 * Read-only aggregation; never creates, updates, or deletes source records.
 */
'use strict';
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const MemoryEvent = require('../models/memory-event');
const PortfolioAsset = require('../models/portfolio-asset');
const { createActivityItem } = require('../lib/activity-item');

const JWT_ISSUER = process.env.JWT_ISSUER || 'vaultflow';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'vaultflow-web';
const JWT_ALGORITHM = 'HS256';

const userSchema = new mongoose.Schema({
  username: String, email: String, sessionVersion: { type: Number, default: 0 }
}, { collection: 'users' });
const User = mongoose.models.User || mongoose.model('User', userSchema);

// Read-only mirrors of the existing server.js schemas and MongoDB collections.
const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  date: { type: Date, required: true }, time: String,
  type: { type: String, enum: ['income', 'expense'], required: true },
  amount: { type: Number, required: true }, category: String, location: String,
  wallet: String, paymentMethod: String, vaultName: String, notes: String, createdAt: Date
}, { collection: 'transactions', strict: false });
transactionSchema.index({ userId: 1, date: -1 });
const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);

const habitSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  name: String, description: String, frequency: {
    type: { type: String, enum: ['daily', 'weekly'] }, daysOfWeek: [Number], targetPerWeek: Number
  },
  startDate: String, endDate: String, status: String
}, { collection: 'habits', strict: false });
const Habit = mongoose.models.Habit || mongoose.model('Habit', habitSchema);

const habitLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  habitId: { type: mongoose.Schema.Types.ObjectId, required: true },
  scheduledDate: String, status: String, completedAt: Date, note: String
}, { collection: 'habitlogs', strict: false });
habitLogSchema.index({ userId: 1, scheduledDate: 1 });
const HabitLog = mongoose.models.HabitLog || mongoose.model('HabitLog', habitLogSchema);

let connectionPromise = null;
async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectionPromise) return connectionPromise;
  if (!process.env.MONGODB_URI) throw Object.assign(new Error('MongoDB is not configured'), { status: 500 });
  connectionPromise = mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000, socketTimeoutMS: 45000,
    maxPoolSize: 10, minPoolSize: 2, bufferCommands: false
  }).then(connection => {
    connectionPromise = null; return connection;
  }).catch(error => {
    connectionPromise = null; throw error;
  });
  return connectionPromise;
}
function sendJson(res, status, payload) { return res.status(status).json(payload); }
function queryValue(req, key) {
  if (req.query && req.query[key] !== undefined) return req.query[key];
  const url = new URL(String(req.url || '/'), 'https://vaultflow.invalid');
  return url.searchParams.get(key);
}
function validateDate(value) {
  const date = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(date + 'T00:00:00.000Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
}
function authenticate(req) {
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw Object.assign(new Error('Access token required'), { status: 401 });
  if (!process.env.JWT_SECRET) throw Object.assign(new Error('Server authentication is not configured'), { status: 500 });
  try {
    return jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: [JWT_ALGORITHM], issuer: JWT_ISSUER, audience: JWT_AUDIENCE
    });
  } catch (_) {
    throw Object.assign(new Error('Invalid or expired token'), { status: 401 });
  }
}
async function getAuthenticatedUser(req) {
  const payload = authenticate(req);
  if (!payload?.userId || !payload?.sub || String(payload.userId) !== String(payload.sub) ||
      !mongoose.isValidObjectId(payload.userId)) {
    throw Object.assign(new Error('Invalid token subject'), { status: 401 });
  }
  const user = await User.findById(payload.userId).select('_id sessionVersion').lean().maxTimeMS(10000);
  if (!user || Number(payload.sessionVersion) !== Number(user.sessionVersion || 0)) {
    throw Object.assign(new Error('Invalid or expired session'), { status: 401 });
  }
  return user;
}
function localTime(value, timezone) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).format(new Date(value));
  } catch (_) { return null; }
}
function isHabitScheduled(habit, date) {
  if (!habit || habit.status !== 'active') return false;
  if (habit.startDate && date < habit.startDate) return false;
  if (habit.endDate && date > habit.endDate) return false;
  if (habit.frequency?.type === 'daily') return true;
  if (habit.frequency?.type === 'weekly') {
    const weekday = new Date(date + 'T12:00:00.000Z').getUTCDay();
    return Array.isArray(habit.frequency.daysOfWeek) && habit.frequency.daysOfWeek.includes(weekday);
  }
  return false;
}
function portfolioSnapshot(assets, asOf) {
  const currencies = {};
  for (const asset of assets) {
    const currency = String(asset.currency || 'UNKNOWN').toUpperCase();
    if (!currencies[currency]) currencies[currency] = {
      currency, positions: 0, investedValue: 0, currentValue: 0, unrealizedGainLoss: 0
    };
    const row = currencies[currency];
    const quantity = Number(asset.quantity || 0);
    const invested = quantity * Number(asset.averageCost || 0);
    const current = quantity * Number(asset.currentPrice || 0);
    row.positions += 1; row.investedValue += invested;
    row.currentValue += current; row.unrealizedGainLoss += current - invested;
  }
  return {
    kind: 'current_snapshot', asOf,
    note: 'Latest stored portfolio valuation; not a historical valuation for the selected date.',
    totalsByCurrency: Object.values(currencies)
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }
  const date = validateDate(queryValue(req, 'date'));
  if (!date) return sendJson(res, 400, { error: 'A valid date query is required in YYYY-MM-DD format' });
  const timezone = String(queryValue(req, 'timezone') || 'Asia/Kolkata');
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }); }
  catch (_) { return sendJson(res, 400, { error: 'Invalid timezone' }); }

  try {
    await connectToDatabase();
    const user = await getAuthenticatedUser(req);
    const start = new Date(date + 'T00:00:00.000Z');
    const end = new Date(date + 'T00:00:00.000Z');
    end.setUTCDate(end.getUTCDate() + 1);

    const [transactions, habits, logs, exactMemories, onThisDayMemories, assets] = await Promise.all([
      Transaction.find({ userId: user._id, date: { $gte: start, $lt: end } })
        .sort({ date: 1, time: 1 }).lean().limit(500).maxTimeMS(10000),
      Habit.find({ userId: user._id }).lean().limit(500).maxTimeMS(10000),
      HabitLog.find({ userId: user._id, scheduledDate: date })
        .sort({ createdAt: 1 }).lean().limit(500).maxTimeMS(10000),
      MemoryEvent.find({ userId: user._id, date })
        .sort({ createdAt: 1 }).lean().limit(200).maxTimeMS(10000),
      MemoryEvent.find({ userId: user._id, date: { $regex: '-' + date.slice(5) + '$' } })
        .sort({ date: -1, createdAt: -1 }).lean().limit(200).maxTimeMS(10000),
      PortfolioAsset.find({ userId: user._id, status: 'active' })
        .sort({ createdAt: -1 }).lean().limit(500).maxTimeMS(10000)
    ]);

    const habitById = new Map(habits.map(habit => [String(habit._id), habit]));
    const activities = [];

    for (const transaction of transactions) {
      activities.push(createActivityItem({
        type: 'transaction', category: transaction.type,
        title: transaction.category || (transaction.type === 'income' ? 'Income' : 'Expense'),
        description: transaction.notes || transaction.location || null,
        date: new Date(transaction.date).toISOString().slice(0, 10),
        time: transaction.time || null, amount: transaction.amount,
        source: { module: 'transactions', recordId: transaction._id },
        metadata: {
          location: transaction.location || null, wallet: transaction.wallet || null,
          paymentMethod: transaction.paymentMethod || null, vaultName: transaction.vaultName || null
        }
      }));
    }
    for (const log of logs) {
      const habit = habitById.get(String(log.habitId));
      activities.push(createActivityItem({
        type: 'habit', category: log.status, title: habit?.name || 'Habit',
        description: log.note || habit?.description || null, date: log.scheduledDate,
        time: log.status === 'completed' ? localTime(log.completedAt, timezone) : null,
        source: { module: 'habits', recordId: log._id },
        metadata: { habitId: String(log.habitId), completedAt: log.completedAt || null }
      }));
    }
    for (const memory of exactMemories) {
      activities.push(createActivityItem({
        type: 'memory', category: memory.category, title: memory.title,
        description: memory.description || memory.location || null, date: memory.date,
        source: { module: 'memories', recordId: memory._id },
        metadata: { location: memory.location || null }
      }));
    }

    activities.sort((a, b) => {
      const left = a.date + 'T' + (a.time || '00:00');
      const right = b.date + 'T' + (b.time || '00:00');
      return left.localeCompare(right) || a.id.localeCompare(b.id);
    });

    const scheduledHabits = habits.filter(habit => isHabitScheduled(habit, date));
    const completed = logs.filter(log => log.status === 'completed').length;
    const skipped = logs.filter(log => log.status === 'skipped').length;
    const missed = logs.filter(log => log.status === 'missed').length;
    const income = transactions.filter(item => item.type === 'income')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const expenses = transactions.filter(item => item.type === 'expense')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const asOf = new Date().toISOString();

    return sendJson(res, 200, {
      contractVersion: 1, date, timezone, generatedAt: asOf,
      summary: {
        transactionCount: transactions.length, income, expenses, netCashFlow: income - expenses,
        habitsScheduled: scheduledHabits.length, habitsCompleted: completed,
        habitsSkipped: skipped, habitsMissed: missed,
        habitsPending: Math.max(0, scheduledHabits.length - logs.length),
        memoryCount: exactMemories.length
      },
      activities,
      onThisDay: onThisDayMemories.map(memory => ({
        id: String(memory._id), date: memory.date, year: Number(memory.date.slice(0, 4)),
        title: memory.title, category: memory.category,
        location: memory.location || null, description: memory.description || null
      })),
      portfolio: portfolioSnapshot(assets, asOf),
      coverage: {
        transactions: true, habits: true, memories: true, notes: false,
        portfolio: 'current_snapshot_only'
      }
    });
  } catch (error) {
    const status = Number(error?.status) || (error?.name === 'ValidationError' ? 400 : 500);
    console.error('Personal OS activity API error:', error);
    return sendJson(res, status, {
      error: status >= 500 ? 'Server error loading daily activity' : (error.message || 'Invalid activity request')
    });
  }
};
