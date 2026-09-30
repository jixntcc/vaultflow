/**
 * VaultFlow Memorable Calendar API
 *
 * Standalone CRUD for personal memories. No Transaction/Habit/Portfolio writes.
 */
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const MemoryEvent = require('../models/memory-event');

const JWT_ISSUER = process.env.JWT_ISSUER || 'vaultflow';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'vaultflow-web';
const JWT_ALGORITHM = 'HS256';

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  sessionVersion: { type: Number, default: 0 }
}, { collection: 'users' });

const User = mongoose.models.User || mongoose.model('User', userSchema);
let connectionPromise = null;

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectionPromise) return connectionPromise;
  if (!process.env.MONGODB_URI) throw Object.assign(new Error('MongoDB is not configured'), { status: 500 });

  connectionPromise = mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    minPoolSize: 2,
    bufferCommands: false
  }).then(connection => {
    connectionPromise = null;
    return connection;
  }).catch(error => {
    connectionPromise = null;
    throw error;
  });

  return connectionPromise;
}

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

function getRequestBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (_) { throw Object.assign(new Error('Invalid JSON request body'), { status: 400 }); }
  }
  if (Buffer.isBuffer(req.body)) {
    try { return JSON.parse(req.body.toString('utf8')); } catch (_) { throw Object.assign(new Error('Invalid JSON request body'), { status: 400 }); }
  }
  return {};
}

function getMemoryId(req) {
  const pathname = String(req.url || '').split('?')[0];
  const prefixes = ['/api/memories', '/api/memories.js'];
  const prefix = prefixes.find(value => pathname === value || pathname.startsWith(value + '/'));
  if (!prefix) return null;
  return pathname.slice(prefix.length).replace(/^\\/+|\\/+$/g, '') || null;
}

function authenticate(req) {
  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) throw Object.assign(new Error('Access token required'), { status: 401 });
  if (!process.env.JWT_SECRET) throw Object.assign(new Error('Server authentication is not configured'), { status: 500 });

  try {
    return jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
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

  const user = await User.findById(payload.userId)
    .select('_id username email sessionVersion')
    .lean()
    .maxTimeMS(10000);

  if (!user) throw Object.assign(new Error('Invalid or expired session'), { status: 401 });

  if (Number(payload.sessionVersion) !== Number(user.sessionVersion || 0)) {
    throw Object.assign(new Error('Session revoked. Please login again.'), { status: 401 });
  }

  return user;
}

function cleanString(value, field, maxLength) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new Error(field + ' must be a string');
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new Error(field + ' is too long');
  return trimmed;
}

function normalizeDate(value) {
  const date = cleanString(value, 'date', 10);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date must use YYYY-MM-DD');
  const parsed = new Date(date + 'T00:00:00');
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error('date must be a valid calendar date');
  }
  return date;
}

function normalizePayload(body = {}, existing = null) {
  const source = existing ? {
    date: body.date ?? existing.date,
    title: body.title ?? existing.title,
    category: body.category ?? existing.category,
    location: body.location ?? existing.location,
    description: body.description ?? existing.description
  } : body;

  const allowed = ['Travel','Milestone','Accident','Relationship','Work','Family','Health','Personal','Other'];
  const date = normalizeDate(source.date);
  const title = cleanString(source.title, 'title', 160);
  const category = cleanString(source.category || 'Personal', 'category', 30);
  const location = cleanString(source.location, 'location', 160);
  const description = cleanString(source.description, 'description', 3000);

  if (!title) throw new Error('title is required');
  if (!allowed.includes(category)) throw new Error('invalid memory category');

  return { date, title, category, location, description };
}

function serialize(item) {
  return {
    ...item,
    _id: String(item._id),
    userId: String(item.userId)
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  try {
    if (!['GET','POST','PUT','DELETE'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, PUT, DELETE');
      return sendJson(res, 405, { error: 'Method not allowed' });
    }

    await connectToDatabase();
    const user = await getAuthenticatedUser(req);
    const id = getMemoryId(req);

    if (id && !mongoose.isValidObjectId(id)) {
      return sendJson(res, 400, { error: 'Invalid memory id' });
    }

    if (req.method === 'GET') {
      const filter = { userId: user._id };
      const items = await MemoryEvent.find(filter).sort({ date: -1, createdAt: -1 }).lean().maxTimeMS(10000);
      return sendJson(res, 200, items.map(serialize));
    }

    if (req.method === 'POST') {
      if (id) return sendJson(res, 400, { error: 'POST does not accept a memory id' });
      const value = normalizePayload(getRequestBody(req));
      const item = await MemoryEvent.create({ userId: user._id, ...value, createdAt: new Date(), updatedAt: new Date() });
      return sendJson(res, 201, serialize(item.toObject()));
    }

    if (!id) return sendJson(res, 400, { error: req.method + ' requires a memory id' });

    if (req.method === 'PUT') {
      const existing = await MemoryEvent.findOne({ _id: id, userId: user._id }).lean().maxTimeMS(10000);
      if (!existing) return sendJson(res, 404, { error: 'Memory not found' });

      const value = normalizePayload(getRequestBody(req), existing);
      const updated = await MemoryEvent.findOneAndUpdate(
        { _id: id, userId: user._id },
        { $set: { ...value, updatedAt: new Date() } },
        { new: true, runValidators: true }
      ).lean().maxTimeMS(10000);

      if (!updated) return sendJson(res, 404, { error: 'Memory not found' });
      return sendJson(res, 200, serialize(updated));
    }

    const deleted = await MemoryEvent.findOneAndDelete({ _id: id, userId: user._id }).lean().maxTimeMS(10000);
    if (!deleted) return sendJson(res, 404, { error: 'Memory not found' });
    return sendJson(res, 200, { message: 'Memory deleted successfully', id: String(deleted._id) });
  } catch (error) {
    const status = Number(error?.status) || (error?.name === 'ValidationError' ? 400 : 500);
    console.error('Memorable Calendar API error:', error);
    return sendJson(res, status, {
      error: status >= 500 ? 'Server error processing memory request' : (error.message || 'Invalid memory data')
    });
  }
};
