'use strict';

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Note = require('../models/note');
const VaultFolder = require('../models/vault-folder');
const VaultFile = require('../models/vault-file');

const JWT_ISSUER = process.env.JWT_ISSUER || 'vaultflow';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'vaultflow-web';
const MAX_ATTACHMENTS = 20;
const MAX_CONTENT_LENGTH = 100000;
const userSchema = new mongoose.Schema({ sessionVersion: { type: Number, default: 0 } }, { collection: 'users' });
const User = mongoose.models.User || mongoose.model('User', userSchema);
let connectionPromise = null;
let indexesPromise = null;

async function connect() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectionPromise) return connectionPromise;
  if (!process.env.MONGODB_URI) throw Object.assign(new Error('MongoDB is not configured'), { status: 500 });
  connectionPromise = mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000, socketTimeoutMS: 45000, maxPoolSize: 10, minPoolSize: 2, bufferCommands: false
  }).then(value => { connectionPromise = null; return value; }).catch(error => { connectionPromise = null; throw error; });
  return connectionPromise;
}
async function ensureIndexes() {
  if (!indexesPromise) indexesPromise = Promise.all([Note.createIndexes(), VaultFolder.createIndexes(), VaultFile.createIndexes()])
    .catch(error => { indexesPromise = null; throw error; });
  return indexesPromise;
}
function send(res, status, body) { return res.status(status).json(body); }
function bodyOf(req) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Buffer.isBuffer(req.body))
    throw Object.assign(new Error('A JSON object body is required'), { status: 400 });
  return req.body;
}
async function authenticate(req) {
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw Object.assign(new Error('Access token required'), { status: 401 });
  if (!process.env.JWT_SECRET) throw Object.assign(new Error('Server authentication is not configured'), { status: 500 });
  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: JWT_ISSUER, audience: JWT_AUDIENCE }); }
  catch (_) { throw Object.assign(new Error('Invalid or expired token'), { status: 401 }); }
  if (!payload?.userId || !payload?.sub || String(payload.userId) !== String(payload.sub) || !mongoose.isValidObjectId(payload.userId))
    throw Object.assign(new Error('Invalid token subject'), { status: 401 });
  const user = await User.findById(payload.userId).select('_id sessionVersion').lean().maxTimeMS(10000);
  if (!user || !Number.isInteger(Number(payload.sessionVersion)) || Number(payload.sessionVersion) !== Number(user.sessionVersion || 0))
    throw Object.assign(new Error('Invalid or expired session'), { status: 401 });
  return user;
}
function normalizeText(value, field, max, required = false) {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string') throw Object.assign(new Error(field + ' must be text'), { status: 400 });
  const result = value.trim();
  if (required && !result) throw Object.assign(new Error(field + ' is required'), { status: 400 });
  if (result.length > max) throw Object.assign(new Error(field + ' exceeds ' + max + ' characters'), { status: 400 });
  return result;
}
function normalizeTags(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 20 || value.some(tag => typeof tag !== 'string' || tag.trim().length > 40))
    throw Object.assign(new Error('tags must be an array of up to 20 strings (40 characters each)'), { status: 400 });
  return [...new Set(value.map(tag => tag.trim().toLowerCase()).filter(Boolean))];
}
function normalizeAttachmentIds(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > MAX_ATTACHMENTS || value.some(id => typeof id !== 'string' || !mongoose.isValidObjectId(id)))
    throw Object.assign(new Error('attachments must contain up to 20 valid file IDs'), { status: 400 });
  return [...new Set(value.map(String))];
}
async function validateRelations(userId, folderId, attachmentIds) {
  if (folderId !== undefined && folderId !== null && folderId !== '') {
    if (typeof folderId !== 'string' || !mongoose.isValidObjectId(folderId))
      throw Object.assign(new Error('Invalid folder id'), { status: 400 });
    const folder = await VaultFolder.findOne({ _id: folderId, userId }).select('_id').lean().maxTimeMS(10000);
    if (!folder) throw Object.assign(new Error('Folder not found'), { status: 404 });
  }
  if (attachmentIds !== undefined && attachmentIds.length) {
    const files = await VaultFile.find({ _id: { $in: attachmentIds }, userId, status: 'available' })
      .select('_id').lean().maxTimeMS(10000);
    if (files.length !== attachmentIds.length)
      throw Object.assign(new Error('One or more attachments are unavailable'), { status: 400 });
  }
}
function serialize(note) {
  return {
    id: String(note._id), folderId: note.folderId ? String(note.folderId) : null,
    title: note.title, content: note.content, category: note.category, tags: note.tags || [],
    pinned: Boolean(note.pinned), status: note.status,
    attachments: (note.attachments || []).map(id => String(id)),
    createdAt: note.createdAt, updatedAt: note.updatedAt
  };
}
function routeOf(pathname) {
  if (pathname === '/api/notes' || pathname === '/api/notes/') return 'collection';
  const match = pathname.match(/^\/api\/notes\/([a-f0-9]{24})\/?$/i);
  return match ? { id: match[1] } : null;
}
async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const pathname = String(req.url || '').split('?')[0];
  const route = routeOf(pathname);
  if (!route) return send(res, 404, { error: 'Notes endpoint not found' });
  try {
    await connect();
    await ensureIndexes();
    const user = await authenticate(req);
    const url = new URL(req.url || '/', 'https://vaultflow.local');

    if (route === 'collection' && req.method === 'GET') {
      const status = url.searchParams.get('status') || 'active';
      if (!['active', 'archived', 'trashed'].includes(status)) return send(res, 400, { error: 'Invalid note status' });
      const page = Number(url.searchParams.get('page') || 1);
      const limitRaw = Number(url.searchParams.get('limit') || 25);
      if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limitRaw) || limitRaw < 1)
        return send(res, 400, { error: 'page and limit must be positive integers' });
      const limit = Math.min(limitRaw, 100);
      const filter = { userId: user._id, status };
      const [total, notes] = await Promise.all([
        Note.countDocuments(filter).maxTimeMS(10000),
        Note.find(filter).select('-__v').sort({ pinned: -1, updatedAt: -1, _id: -1 })
          .skip((page - 1) * limit).limit(limit).lean().maxTimeMS(10000)
      ]);
      return send(res, 200, { notes: notes.map(serialize), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    }

    if (route === 'collection' && req.method === 'POST') {
      const body = bodyOf(req);
      const title = normalizeText(body.title, 'title', 160, true);
      const content = normalizeText(body.content ?? '', 'content', MAX_CONTENT_LENGTH);
      const category = normalizeText(body.category ?? 'Personal', 'category', 60);
      const tags = normalizeTags(body.tags) ?? [];
      const attachments = normalizeAttachmentIds(body.attachments) ?? [];
      const folderId = body.folderId ?? null;
      await validateRelations(user._id, folderId, attachments);
      const note = await Note.create({ userId: user._id, folderId: folderId || null, title, content, category, tags, attachments });
      return send(res, 201, { note: serialize(note) });
    }

    if (route !== 'collection' && req.method === 'GET') {
      const note = await Note.findOne({ _id: route.id, userId: user._id }).lean().maxTimeMS(10000);
      return note ? send(res, 200, { note: serialize(note) }) : send(res, 404, { error: 'Note not found' });
    }

    if (route !== 'collection' && req.method === 'PATCH') {
      const body = bodyOf(req);
      const update = {};
      if (Object.hasOwn(body, 'title')) update.title = normalizeText(body.title, 'title', 160, true);
      if (Object.hasOwn(body, 'content')) update.content = normalizeText(body.content, 'content', MAX_CONTENT_LENGTH);
      if (Object.hasOwn(body, 'category')) update.category = normalizeText(body.category, 'category', 60);
      if (Object.hasOwn(body, 'tags')) update.tags = normalizeTags(body.tags);
      if (Object.hasOwn(body, 'pinned')) {
        if (typeof body.pinned !== 'boolean') return send(res, 400, { error: 'pinned must be a boolean' });
        update.pinned = body.pinned;
      }
      if (Object.hasOwn(body, 'folderId')) update.folderId = body.folderId || null;
      if (Object.hasOwn(body, 'attachments')) update.attachments = normalizeAttachmentIds(body.attachments);
      if (Object.hasOwn(body, 'status')) {
        if (!['active', 'archived', 'trashed'].includes(body.status)) return send(res, 400, { error: 'Invalid note status' });
        update.status = body.status;
        if (body.status === 'trashed') update.deletedAt = new Date();
        else update.deletedAt = null;
      }
      if (!Object.keys(update).length) return send(res, 400, { error: 'No supported note fields supplied' });
      await validateRelations(user._id, update.folderId, update.attachments);
      const note = await Note.findOneAndUpdate({ _id: route.id, userId: user._id }, { $set: update }, { new: true, runValidators: true })
        .lean().maxTimeMS(10000);
      return note ? send(res, 200, { note: serialize(note) }) : send(res, 404, { error: 'Note not found' });
    }

    if (route !== 'collection' && req.method === 'DELETE') {
      const note = await Note.findOneAndUpdate(
        { _id: route.id, userId: user._id, status: { $ne: 'trashed' } },
        { $set: { status: 'trashed', deletedAt: new Date() } },
        { new: true }
      ).lean().maxTimeMS(10000);
      return note ? send(res, 200, { note: serialize(note) }) : send(res, 404, { error: 'Note not found' });
    }
    res.setHeader('Allow', route === 'collection' ? 'GET, POST' : 'GET, PATCH, DELETE');
    return send(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    const status = Number(error?.status) || (error?.name === 'ValidationError' ? 400 : 500);
    console.error('Notes API error:', error?.message || error);
    return send(res, status, { error: status >= 500 ? 'Unable to process notes request' : error.message });
  }
}
module.exports = handler;
module.exports.routeOf = routeOf;
module.exports.normalizeText = normalizeText;
module.exports.normalizeTags = normalizeTags;
module.exports.normalizeAttachmentIds = normalizeAttachmentIds;
module.exports.MAX_CONTENT_LENGTH = MAX_CONTENT_LENGTH;
module.exports.MAX_ATTACHMENTS = MAX_ATTACHMENTS;
