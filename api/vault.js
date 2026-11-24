'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const VaultFile = require('../models/vault-file');
const VaultUsage = require('../models/vault-usage');
const VaultFolder = require('../models/vault-folder');
const { createPresignedPutUrl, headR2Object, promoteR2Object, deleteR2Object } = require('../lib/storage/r2');

const JWT_ISSUER = process.env.JWT_ISSUER || 'vaultflow';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'vaultflow-web';
const JWT_ALGORITHM = 'HS256';
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const UPLOAD_URL_TTL_SECONDS = 300;

const MIME_TYPES = Object.freeze({
  'application/pdf': { extension: 'pdf', category: 'document' },
  'image/jpeg': { extension: 'jpg', category: 'image' },
  'image/png': { extension: 'png', category: 'image' },
  'image/webp': { extension: 'webp', category: 'image' },
  'image/gif': { extension: 'gif', category: 'image' },
  'text/plain': { extension: 'txt', category: 'text' },
  'text/csv': { extension: 'csv', category: 'spreadsheet' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    extension: 'docx', category: 'document'
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    extension: 'xlsx', category: 'spreadsheet'
  }
});

const userSchema = new mongoose.Schema({
  sessionVersion: { type: Number, default: 0 }
}, { collection: 'users' });
const User = mongoose.models.User || mongoose.model('User', userSchema);

let connectionPromise = null;
let indexesPromise = null;

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectionPromise) return connectionPromise;
  if (!process.env.MONGODB_URI) {
    throw Object.assign(new Error('MongoDB is not configured'), { status: 500 });
  }

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

async function ensureVaultIndexes() {
  if (!indexesPromise) {
    indexesPromise = Promise.all([
      VaultUsage.createIndexes(),
      VaultFile.createIndexes()
    ]).catch(error => {
      indexesPromise = null;
      throw error;
    });
  }
  return indexesPromise;
}

function sendJson(res, status, payload) {
  return res.status(status).json(payload);
}

function getRequestBody(req) {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) || Buffer.isBuffer(body)) {
    throw Object.assign(new Error('A JSON object body is required'), { status: 400 });
  }
  return body;
}

function authenticate(req) {
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw Object.assign(new Error('Access token required'), { status: 401 });
  if (!process.env.JWT_SECRET) {
    throw Object.assign(new Error('Server authentication is not configured'), { status: 500 });
  }

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
  if (!payload?.userId || !payload?.sub ||
      String(payload.userId) !== String(payload.sub) ||
      !mongoose.isValidObjectId(payload.userId)) {
    throw Object.assign(new Error('Invalid token subject'), { status: 401 });
  }

  const user = await User.findById(payload.userId)
    .select('_id sessionVersion')
    .lean()
    .maxTimeMS(10000);

  if (!user || !Number.isInteger(Number(payload.sessionVersion)) ||
      Number(payload.sessionVersion) !== Number(user.sessionVersion || 0)) {
    throw Object.assign(new Error('Invalid or expired session'), { status: 401 });
  }
  return user;
}

function normalizeUploadRequest(body) {
  const originalName = typeof body.originalName === 'string' ? body.originalName.trim() : '';
  if (!originalName || originalName.length > 255 ||
      originalName === '.' || originalName === '..' ||
      /[\/\\\u0000-\u001f]/.test(originalName)) {
    throw Object.assign(new Error('A valid filename is required'), { status: 400 });
  }

  const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim().toLowerCase() : '';
  const fileType = MIME_TYPES[mimeType];
  if (!fileType) {
    throw Object.assign(new Error('This file type is not supported'), { status: 415 });
  }

  const sizeBytes = body.sizeBytes;
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    throw Object.assign(new Error('sizeBytes must be a positive integer'), { status: 400 });
  }
  if (sizeBytes > MAX_FILE_BYTES) {
    throw Object.assign(new Error('Maximum file size is 100 MiB'), { status: 413 });
  }

  let folderId = null;
  if (body.folderId !== undefined && body.folderId !== null && body.folderId !== '') {
    if (typeof body.folderId !== 'string' || !mongoose.isValidObjectId(body.folderId)) {
      throw Object.assign(new Error('Invalid folder id'), { status: 400 });
    }
    folderId = body.folderId;
  }

  return { originalName, mimeType, sizeBytes, folderId, ...fileType };
}

async function ensureUsageRecord(userId) {
  try {
    return await VaultUsage.findOneAndUpdate(
      { userId },
      {
        $setOnInsert: {
          userId,
          plan: 'free',
          quotaBytes: VaultUsage.DEFAULT_QUOTA_BYTES,
          usedBytes: 0,
          reservedBytes: 0
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean().maxTimeMS(10000);
  } catch (error) {
    // Concurrent first uploads may race to create the unique per-user ledger.
    if (error?.code !== 11000) throw error;
    return VaultUsage.findOne({ userId }).lean().maxTimeMS(10000);
  }
}

async function reserveQuota(userId, sizeBytes) {
  return VaultUsage.findOneAndUpdate(
    {
      userId,
      $expr: {
        $lte: [
          { $add: ['$usedBytes', '$reservedBytes', sizeBytes] },
          '$quotaBytes'
        ]
      }
    },
    { $inc: { reservedBytes: sizeBytes } },
    { new: true }
  ).lean().maxTimeMS(10000);
}

async function releaseReservation(userId, sizeBytes) {
  await VaultUsage.updateOne(
    { userId, reservedBytes: { $gte: sizeBytes } },
    { $inc: { reservedBytes: -sizeBytes } }
  ).maxTimeMS(10000);
}

function getCompletionFileId(pathname) {
  const match = pathname.match(/^\/api\/vault\/uploads\/([a-f0-9]{24})\/complete\/?$/i);
  return match ? match[1] : null;
}

async function failPendingUpload(file, reason) {
  const session = await mongoose.startSession();
  let didFail = false;
  try {
    await session.withTransaction(async () => {
      const failed = await VaultFile.findOneAndUpdate(
        { _id: file._id, userId: file.userId, status: 'pending_upload' },
        { $set: { status: 'failed' } },
        { new: true, session }
      );
      if (!failed) return;
      didFail = true;
      const update = await VaultUsage.updateOne(
        { userId: file.userId, reservedBytes: { $gte: file.sizeBytes } },
        { $inc: { reservedBytes: -file.sizeBytes } },
        { session }
      );
      if (update.modifiedCount !== 1) throw new Error('Unable to release failed upload reservation');
    });
  } finally { await session.endSession(); }
  if (didFail) {
    await deleteR2Object(file.uploadObjectKey).catch(error => console.error('Vault invalid staging cleanup failed:', error?.message || error));
    console.warn('Vault upload rejected:', reason);
  }
}

async function completeUpload(userId, fileId) {
  const file = await VaultFile.findOne({ _id: fileId, userId }).lean().maxTimeMS(10000);
  if (!file) return { status: 404, body: { error: 'File not found' } };
  if (file.status === 'quarantined' || file.status === 'available') {
    return { status: 200, body: { fileId: String(file._id), status: file.status, idempotent: true } };
  }
  if (file.status !== 'pending_upload') return { status: 409, body: { error: 'This upload cannot be completed', status: file.status } };

  let sourceHead;
  try { sourceHead = await headR2Object(file.uploadObjectKey); }
  catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound' || error?.name === 'NoSuchKey') {
      return { status: 409, body: { error: 'The uploaded object was not found in storage yet' } };
    }
    throw error;
  }

  if (Number(sourceHead.ContentLength) !== file.sizeBytes ||
      String(sourceHead.ContentType || '').toLowerCase() !== String(file.mimeType).toLowerCase()) {
    await failPendingUpload(file, 'Object size or content type mismatch');
    return { status: 422, body: { error: 'Uploaded file does not match the declared size or content type' } };
  }
  if (!sourceHead.ETag) throw Object.assign(new Error('Storage did not return an object ETag'), { status: 503 });

  await promoteR2Object({ sourceKey: file.uploadObjectKey, destinationKey: file.objectKey, sourceEtag: sourceHead.ETag, contentType: file.mimeType });
  const finalHead = await headR2Object(file.objectKey);
  if (Number(finalHead.ContentLength) !== file.sizeBytes ||
      String(finalHead.ContentType || '').toLowerCase() !== String(file.mimeType).toLowerCase()) {
    await deleteR2Object(file.objectKey).catch(() => {});
    throw Object.assign(new Error('Promoted object failed verification'), { status: 503 });
  }

  const session = await mongoose.startSession();
  let completedFile = null;
  try {
    await session.withTransaction(async () => {
      completedFile = await VaultFile.findOneAndUpdate(
        { _id: file._id, userId, status: 'pending_upload' },
        { $set: { status: 'quarantined', etag: finalHead.ETag || sourceHead.ETag } },
        { new: true, session }
      ).lean();
      if (!completedFile) {
        const current = await VaultFile.findOne({ _id: file._id, userId }).session(session).lean();
        if (current && ['quarantined', 'available'].includes(current.status)) { completedFile = current; return; }
        throw Object.assign(new Error('Upload state changed before completion'), { status: 409 });
      }
      const usageUpdate = await VaultUsage.updateOne(
        { userId, reservedBytes: { $gte: file.sizeBytes } },
        { $inc: { reservedBytes: -file.sizeBytes, usedBytes: file.sizeBytes } },
        { session }
      );
      if (usageUpdate.modifiedCount !== 1) throw new Error('Unable to reconcile upload quota reservation');
    });
  } catch (error) {
    const current = await VaultFile.findOne({ _id: file._id, userId }).lean().catch(() => null);
    if (!current || ['pending_upload', 'failed'].includes(current.status)) {
      await deleteR2Object(file.objectKey).catch(cleanupError => console.error('Vault promoted cleanup failed:', cleanupError?.message || cleanupError));
    }
    throw error;
  } finally { await session.endSession(); }

  let stagingCleanupPending = false;
  try { await deleteR2Object(file.uploadObjectKey); }
  catch (error) { stagingCleanupPending = true; console.error('Vault staging cleanup failed:', error?.message || error); }
  return { status: 200, body: { fileId: String(file._id), status: completedFile.status, sizeBytes: file.sizeBytes, stagingCleanupPending } };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');

  const pathname = String(req.url || '').split('?')[0];
  const completionFileId = getCompletionFileId(pathname);
  const isInitRoute = /^\/api\/vault\/uploads(?:\.js)?\/?$/.test(pathname);
  if (!isInitRoute && !completionFileId) return sendJson(res, 404, { error: 'Vault endpoint not found' });

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  if (completionFileId) {
    try {
      await connectToDatabase();
      const user = await getAuthenticatedUser(req);
      const result = await completeUpload(user._id, completionFileId);
      return sendJson(res, result.status, result.body);
    } catch (error) {
      const status = Number(error?.status) || 500;
      console.error('Vault upload completion error:', error?.message || error);
      return sendJson(res, status, { error: status >= 500 ? 'Unable to verify uploaded file' : error.message });
    }
  }

  let reserved = false;
  let createdFileId = null;
  let userId = null;
  let sizeBytes = null;

  try {
    await connectToDatabase();
    await ensureVaultIndexes();
    const user = await getAuthenticatedUser(req);
    userId = user._id;

    const upload = normalizeUploadRequest(getRequestBody(req));

    if (upload.folderId) {
      const folder = await VaultFolder.findOne({
        _id: upload.folderId,
        userId: user._id
      }).select('_id').lean().maxTimeMS(10000);
      if (!folder) return sendJson(res, 404, { error: 'Folder not found' });
    }

    sizeBytes = upload.sizeBytes;
    await ensureUsageRecord(user._id);
    const usage = await reserveQuota(user._id, sizeBytes);
    if (!usage) {
      return sendJson(res, 409, { error: 'Storage quota exceeded' });
    }
    reserved = true;

    const objectKey = 'vault/' + crypto.randomUUID();
    const uploadObjectKey = 'vault-staging/' + crypto.randomUUID();
    const expiresAt = new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000);

    const file = await VaultFile.create({
      userId: user._id,
      folderId: upload.folderId,
      storageProvider: 'r2',
      objectKey,
      uploadObjectKey,
      originalName: upload.originalName,
      mimeType: upload.mimeType,
      extension: upload.extension,
      sizeBytes,
      category: upload.category,
      status: 'pending_upload',
      encryptionMode: 'provider_managed',
      uploadExpiresAt: expiresAt
    });
    createdFileId = file._id;

    const uploadUrl = await createPresignedPutUrl({
      key: uploadObjectKey,
      contentType: upload.mimeType,
      contentLength: sizeBytes,
      expiresIn: UPLOAD_URL_TTL_SECONDS
    });

    return sendJson(res, 201, {
      fileId: String(file._id),
      status: 'pending_upload',
      upload: {
        method: 'PUT',
        url: uploadUrl,
        headers: { 'Content-Type': upload.mimeType },
        expiresAt: expiresAt.toISOString()
      },
      file: {
        name: file.originalName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes
      },
      quota: {
        quotaBytes: usage.quotaBytes,
        usedBytes: usage.usedBytes,
        reservedBytes: usage.reservedBytes,
        availableBytes: Math.max(0, usage.quotaBytes - usage.usedBytes - usage.reservedBytes)
      }
    });
  } catch (error) {
    if (reserved && userId && Number.isSafeInteger(sizeBytes)) {
      try {
        if (createdFileId) {
          await VaultFile.deleteOne({ _id: createdFileId, userId });
        }
        await releaseReservation(userId, sizeBytes);
      } catch (cleanupError) {
        console.error('Vault upload initialization cleanup failed:', cleanupError?.message || cleanupError);
      }
    }

    const status = Number(error?.status) || (error?.name === 'ValidationError' ? 400 : 500);
    console.error('Vault upload initialization error:', error?.message || error);
    return sendJson(res, status, {
      error: status >= 500 ? 'Unable to initialize upload' : error.message
    });
  }
};

module.exports.MAX_FILE_BYTES = MAX_FILE_BYTES;
module.exports.UPLOAD_URL_TTL_SECONDS = UPLOAD_URL_TTL_SECONDS;
module.exports.MIME_TYPES = MIME_TYPES;
module.exports.normalizeUploadRequest = normalizeUploadRequest;
module.exports.getCompletionFileId = getCompletionFileId;
