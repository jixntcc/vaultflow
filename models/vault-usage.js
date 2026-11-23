'use strict';

const mongoose = require('mongoose');

const DEFAULT_VAULT_QUOTA_BYTES = 2 * 1024 * 1024 * 1024;

const vaultUsageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  plan: {
    type: String,
    enum: ['free', 'paid'],
    default: 'free',
    required: true
  },
  quotaBytes: {
    type: Number,
    min: 0,
    default: DEFAULT_VAULT_QUOTA_BYTES,
    required: true,
    validate: {
      validator: Number.isSafeInteger,
      message: 'Quota must be a safe integer number of bytes'
    }
  },
  usedBytes: {
    type: Number,
    min: 0,
    default: 0,
    required: true,
    validate: {
      validator: Number.isSafeInteger,
      message: 'Used storage must be a safe integer number of bytes'
    }
  },
  reservedBytes: {
    type: Number,
    min: 0,
    default: 0,
    required: true,
    validate: {
      validator: Number.isSafeInteger,
      message: 'Reserved storage must be a safe integer number of bytes'
    }
  }
}, {
  timestamps: true,
  collection: 'vaultusage'
});

vaultUsageSchema.index(
  { userId: 1 },
  { unique: true, name: 'uniq_vault_usage_per_user' }
);

vaultUsageSchema.statics.DEFAULT_QUOTA_BYTES = DEFAULT_VAULT_QUOTA_BYTES;

module.exports = mongoose.models.VaultUsage ||
  mongoose.model('VaultUsage', vaultUsageSchema);
