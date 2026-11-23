'use strict';

const mongoose = require('mongoose');

const VAULT_FILE_STATUSES = [
  'pending_upload',
  'quarantined',
  'available',
  'trashed',
  'deleting',
  'deleted',
  'failed'
];

const vaultFileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  folderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VaultFolder',
    default: null
  },
  storageProvider: {
    type: String,
    trim: true,
    lowercase: true,
    default: 'r2',
    required: true,
    maxlength: 40
  },
  objectKey: {
    type: String,
    required: true,
    immutable: true,
    trim: true
  },
  originalName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255,
    validate: {
      validator: value => typeof value === 'string' &&
        value.length > 0 && !/[\\/\\\\\\u0000-\\u001f]/.test(value),
      message: 'File name must not contain path separators or control characters'
    }
  },
  mimeType: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 160
  },
  extension: {
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 16,
    default: ''
  },
  sizeBytes: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: Number.isSafeInteger,
      message: 'File size must be a safe integer number of bytes'
    }
  },
  checksumSha256: {
    type: String,
    lowercase: true,
    trim: true,
    match: /^[a-f0-9]{64}$/
  },
  etag: {
    type: String,
    trim: true,
    maxlength: 160
  },
  category: {
    type: String,
    enum: ['document', 'image', 'spreadsheet', 'text', 'other'],
    default: 'other'
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 40
  }],
  status: {
    type: String,
    enum: VAULT_FILE_STATUSES,
    default: 'pending_upload',
    required: true
  },
  encryptionMode: {
    type: String,
    enum: ['provider_managed', 'client_side'],
    default: 'provider_managed',
    required: true
  },
  cryptoVersion: {
    type: String,
    trim: true,
    maxlength: 40,
    default: null
  },
  uploadExpiresAt: {
    type: Date,
    default: null
  },
  deletedAt: {
    type: Date,
    default: null
  },
  purgeAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  collection: 'vaultfiles'
});

vaultFileSchema.index(
  { objectKey: 1 },
  { unique: true, name: 'uniq_vault_file_object_key' }
);
vaultFileSchema.index(
  { userId: 1, status: 1, createdAt: -1 },
  { name: 'vault_files_by_user_status' }
);
vaultFileSchema.index(
  { userId: 1, folderId: 1, status: 1, createdAt: -1 },
  { name: 'vault_files_by_folder' }
);
vaultFileSchema.index(
  { userId: 1, tags: 1, status: 1 },
  { name: 'vault_files_by_tag' }
);

vaultFileSchema.statics.STATUSES = VAULT_FILE_STATUSES;

module.exports = mongoose.models.VaultFile ||
  mongoose.model('VaultFile', vaultFileSchema);
