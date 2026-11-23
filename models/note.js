'use strict';

const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
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
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 160
  },
  content: {
    type: String,
    default: '',
    maxlength: 100000
  },
  category: {
    type: String,
    trim: true,
    maxlength: 60,
    default: 'Personal'
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 40
  }],
  pinned: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'trashed'],
    default: 'active',
    required: true
  },
  attachments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VaultFile'
  }],
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
  collection: 'notes'
});

noteSchema.index(
  { userId: 1, status: 1, updatedAt: -1 },
  { name: 'notes_by_user_status_update' }
);
noteSchema.index(
  { userId: 1, folderId: 1, status: 1, updatedAt: -1 },
  { name: 'notes_by_folder' }
);
noteSchema.index(
  { userId: 1, tags: 1, status: 1 },
  { name: 'notes_by_tag' }
);

module.exports = mongoose.models.Note ||
  mongoose.model('Note', noteSchema);
