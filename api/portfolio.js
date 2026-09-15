/**
 * VaultFlow Portfolio API
 *
 * P3.2: standalone investment-position CRUD.
 * This endpoint intentionally does not read from or write to Transaction.
 */

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const PortfolioAsset = require('../models/portfolio-asset');

const JWT_ISSUER = process.env.JWT_ISSUER || 'vaultflow';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'vaultflow-web';
const JWT_ALGORITHM = 'HS256';

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  sessionVersion: { type: Number, default: 0 }
}, { collection: 'users' });

const User = mongoose.models.User || mongoose.model('User', userSchema);

let userSchemaConnectionPromise = null;

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (userSchemaConnectionPromise) return userSchemaConnectionPromise;

  if (!process.env.MONGODB_URI) {
    throw new Error('MongoDB is not configured');
  }

  userSchemaConnectionPromise = mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    minPoolSize: 2,
    bufferCommands: false
  }).then(connection => {
    userSchemaConnectionPromise = null;
    return connection;
  }).catch(error => {
    userSchemaConnectionPromise = null;
    throw error;
  });

  return userSchemaConnectionPromise;
}

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

function getPortfolioId(req) {
  const rawUrl = String(req.url || '');
  const pathname = rawUrl.split('?')[0];
  const prefix = '/api/portfolio';
  if (!pathname.startsWith(prefix)) return null;
  const suffix = pathname.slice(prefix.length).replace(/^\/+|\/+$/g, '');
  return suffix || null;
}

function authenticate(req) {
  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';

  if (!token) {
    const error = new Error('Access token required');
    error.status = 401;
    throw error;
  }

  if (!process.env.JWT_SECRET) {
    const error = new Error('Server authentication is not configured');
    error.status = 500;
    throw error;
  }

  try {
    return jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    });
  } catch (_) {
    const error = new Error('Invalid or expired token');
    error.status = 401;
    throw error;
  }
}

async function getAuthenticatedUser(req) {
  const payload = authenticate(req);

  if (!payload?.userId || !payload?.sub || String(payload.userId) !== String(payload.sub)) {
    const error = new Error('Invalid token subject');
    error.status = 401;
    throw error;
  }

  if (!mongoose.isValidObjectId(payload.userId)) {
    const error = new Error('Invalid token subject');
    error.status = 401;
    throw error;
  }

  const user = await User.findById(payload.userId)
    .select('_id username email sessionVersion')
    .lean()
    .maxTimeMS(10000);

  if (!user) {
    const error = new Error('Invalid or expired session');
    error.status = 401;
    throw error;
  }

  const tokenVersion = Number(payload.sessionVersion);
  const currentVersion = Number(user.sessionVersion || 0);
  if (!Number.isInteger(tokenVersion) || tokenVersion !== currentVersion) {
    const error = new Error('Session revoked. Please login again.');
    error.status = 401;
    throw error;
  }

  return user;
}

function cleanString(value, field, maxLength = 200) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new Error(`${field} is too long`);
  return trimmed;
}

function normalizeNumber(value, field, { min = 0, required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new Error(`${field} is required`);
    return undefined;
  }

  const number = Number(value);
  if (!Number.isFinite(number) || number < min) {
    throw new Error(`${field} must be a valid number >= ${min}`);
  }
  return number;
}

function normalizePayload(body = {}, existing = null) {
  const source = existing ? {
    assetType: body.assetType ?? existing.assetType,
    symbol: body.symbol ?? existing.symbol,
    name: body.name ?? existing.name,
    quantity: body.quantity ?? existing.quantity,
    averageCost: body.averageCost ?? existing.averageCost,
    currency: body.currency ?? existing.currency,
    currentPrice: body.currentPrice ?? existing.currentPrice,
    broker: body.broker ?? existing.broker,
    exchange: body.exchange ?? existing.exchange,
    wallet: body.wallet ?? existing.wallet,
    notes: body.notes ?? existing.notes,
    status: body.status ?? existing.status
  } : body;

  const assetType = cleanString(source.assetType, 'assetType', 20);
  const allowedTypes = ['stock', 'crypto', 'forex', 'gold', 'bond', 'other'];
  if (!allowedTypes.includes(assetType)) {
    throw new Error('assetType must be one of: stock, crypto, forex, gold, bond, other');
  }

  const symbol = cleanString(source.symbol, 'symbol', 40)?.toUpperCase();
  const name = cleanString(source.name, 'name', 160);
  const currency = cleanString(source.currency, 'currency', 12)?.toUpperCase();

  if (!symbol) throw new Error('symbol is required');
  if (!name) throw new Error('name is required');
  if (!currency) throw new Error('currency is required');

  const status = cleanString(source.status, 'status', 20) || 'active';
  if (!['active', 'closed'].includes(status)) {
    throw new Error('status must be active or closed');
  }

  const quantity = normalizeNumber(source.quantity, 'quantity', { min: 0, required: true });
  const averageCost = normalizeNumber(source.averageCost, 'averageCost', { min: 0, required: true });
  const currentPrice = normalizeNumber(source.currentPrice, 'currentPrice', { min: 0 }) ?? 0;

  return {
    assetType,
    symbol,
    name,
    quantity,
    averageCost,
    currency,
    currentPrice,
    broker: cleanString(source.broker, 'broker', 160),
    exchange: cleanString(source.exchange, 'exchange', 160),
    wallet: cleanString(source.wallet, 'wallet', 160),
    notes: cleanString(source.notes, 'notes', 2000),
    status
  };
}

function withCalculatedValues(asset) {
  const investedValue = Number(asset.quantity || 0) * Number(asset.averageCost || 0);
  const currentValue = Number(asset.quantity || 0) * Number(asset.currentPrice || 0);
  const unrealizedGainLoss = currentValue - investedValue;
  const returnPercent = investedValue > 0
    ? (unrealizedGainLoss / investedValue) * 100
    : 0;

  return {
    ...asset,
    investedValue,
    currentValue,
    unrealizedGainLoss,
    returnPercent
  };
}

function serialize(asset) {
  return withCalculatedValues({
    ...asset,
    _id: String(asset._id),
    userId: String(asset.userId)
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  try {
    if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, PUT, DELETE');
      return sendJson(res, 405, { error: 'Method not allowed' });
    }

    await connectToDatabase();
    const user = await getAuthenticatedUser(req);
    const portfolioId = getPortfolioId(req);

    if (portfolioId && !mongoose.isValidObjectId(portfolioId)) {
      return sendJson(res, 400, { error: 'Invalid portfolio asset id' });
    }

    if (req.method === 'GET') {
      if (portfolioId) {
        const asset = await PortfolioAsset.findOne({
          _id: portfolioId,
          userId: user._id
        }).lean().maxTimeMS(10000);

        if (!asset) return sendJson(res, 404, { error: 'Portfolio asset not found' });
        return sendJson(res, 200, serialize(asset));
      }

      const requestedStatus = String(req.query?.status || 'active').toLowerCase();
      const filter = { userId: user._id };
      if (requestedStatus !== 'all') {
        if (!['active', 'closed'].includes(requestedStatus)) {
          return sendJson(res, 400, { error: 'status must be active, closed, or all' });
        }
        filter.status = requestedStatus;
      }

      const assets = await PortfolioAsset.find(filter)
        .sort({ createdAt: -1 })
        .lean()
        .maxTimeMS(10000);

      return sendJson(res, 200, assets.map(serialize));
    }

    if (req.method === 'POST') {
      if (portfolioId) return sendJson(res, 400, { error: 'POST does not accept an asset id' });
      const value = normalizePayload(req.body || {});
      const asset = await PortfolioAsset.create({
        userId: user._id,
        ...value,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return sendJson(res, 201, serialize(asset.toObject()));
    }

    if (!portfolioId) {
      return sendJson(res, 400, { error: `${req.method} requires a portfolio asset id` });
    }

    if (req.method === 'PUT') {
      const existing = await PortfolioAsset.findOne({
        _id: portfolioId,
        userId: user._id
      }).lean().maxTimeMS(10000);

      if (!existing) return sendJson(res, 404, { error: 'Portfolio asset not found' });

      const value = normalizePayload(req.body || {}, existing);
      const updated = await PortfolioAsset.findOneAndUpdate(
        { _id: portfolioId, userId: user._id },
        { $set: { ...value, updatedAt: new Date() } },
        { new: true, runValidators: true }
      ).lean().maxTimeMS(10000);

      if (!updated) return sendJson(res, 404, { error: 'Portfolio asset not found' });
      return sendJson(res, 200, serialize(updated));
    }

    const deleted = await PortfolioAsset.findOneAndDelete({
      _id: portfolioId,
      userId: user._id
    }).lean().maxTimeMS(10000);

    if (!deleted) return sendJson(res, 404, { error: 'Portfolio asset not found' });
    return sendJson(res, 200, {
      message: 'Portfolio asset deleted successfully',
      id: String(deleted._id)
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    console.error('Portfolio API error:', error);

    if (error?.name === 'ValidationError' || status === 400) {
      return sendJson(res, 400, { error: error.message || 'Invalid portfolio data' });
    }

    if (error?.name === 'CastError') {
      return sendJson(res, 400, { error: 'Invalid portfolio asset data' });
    }

    return sendJson(res, status, {
      error: status === 503 ? 'Database connection failed' : 'Server error processing portfolio request'
    });
  }
};
