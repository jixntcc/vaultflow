'use strict';

const mongoose = require('mongoose');

const vaultFolderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VaultFolder',
    default: null
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80
  },
  normalizedName: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    maxlength: 80
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
    default: ''
  }
}, {
  timestamps: true,
  collection: 'vaultfolders'
});

vaultFolderSchema.pre('validate', function normalizeFolderName(next) {
  if (typeof this.name === 'string') {
    this.name = this.name.trim();
    this.normalizedName = this.name.toLocaleLowerCase('en-US');
  }
  next();
});

// Folder names are unique only within the same user's parent folder.
// A null parentId represents a root-level folder.
vaultFolderSchema.index(
  { userId: 1, parentId: 1, normalizedName: 1 },
  { unique: true, name: 'uniq_vault_folder_name_per_parent' }
);
vaultFolderSchema.index(
  { userId: 1, parentId: 1, updatedAt: -1 },
  { name: 'vault_folder_children_by_update' }
);

module.exports = mongoose.models.VaultFolder ||
  mongoose.model('VaultFolder', vaultFolderSchema);
