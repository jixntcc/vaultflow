/**
 * VaultFlow Portfolio Asset model
 *
 * P3.1: stores the user's current investment positions separately from the
 * existing Transaction ledger. Investment activity will be linked back to
 * this model in P3.2 through portfolioAssetId on Transaction.
 */

const mongoose = require('mongoose');

const portfolioAssetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  assetType: {
    type: String,
    enum: ['stock', 'crypto', 'forex', 'gold', 'bond', 'other'],
    required: true
  },

  symbol: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },

  name: {
    type: String,
    required: true,
    trim: true
  },

  quantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },

  averageCost: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },

  currency: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    default: 'USD'
  },

  // Latest known market price. P3.5 will populate/update this field.
  currentPrice: {
    type: Number,
    min: 0,
    default: 0
  },

  // Optional source/context for the holding.
  broker: {
    type: String,
    trim: true
  },

  exchange: {
    type: String,
    trim: true
  },

  wallet: {
    type: String,
    trim: true
  },

  notes: {
    type: String,
    trim: true
  },

  status: {
    type: String,
    enum: ['active', 'closed'],
    default: 'active'
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Portfolio queries are always user-scoped.
portfolioAssetSchema.index({ userId: 1, status: 1 });
portfolioAssetSchema.index({ userId: 1, symbol: 1, assetType: 1 });

module.exports = mongoose.models.PortfolioAsset ||
  mongoose.model('PortfolioAsset', portfolioAssetSchema);
