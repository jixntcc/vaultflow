/**
 * VaultFlow Memorable Calendar model
 *
 * Stores significant personal moments independently from transactions,
 * habits, goals, and portfolio positions.
 */
const mongoose = require('mongoose');

const memoryEventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  date: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 160
  },
  category: {
    type: String,
    enum: ['Travel', 'Milestone', 'Accident', 'Relationship', 'Work', 'Family', 'Health', 'Personal', 'Other'],
    default: 'Personal'
  },
  location: {
    type: String,
    trim: true,
    maxlength: 160
  },
  description: {
    type: String,
    trim: true,
    maxlength: 3000
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

memoryEventSchema.index({ userId: 1, date: -1 });
memoryEventSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.models.MemoryEvent ||
  mongoose.model('MemoryEvent', memoryEventSchema);
