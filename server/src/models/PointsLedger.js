const mongoose = require('mongoose');

const LEDGER_TYPE = ['earned', 'override'];
const LEDGER_SOURCE = ['task', 'event_referral', 'override', 'manual'];

const pointsLedgerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Submission',
      default: null,
    },
    // Event that triggered this award (for event_referral source entries)
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      default: null,
    },
    points: { type: Number, required: true },
    type: { type: String, enum: LEDGER_TYPE, default: 'earned' },
    // source gives finer-grained categorisation than type
    source: { type: String, enum: LEDGER_SOURCE, default: 'task' },
    // Referral code used when source === 'event_referral'
    referralCode: { type: String, default: null },
    reason: { type: String, default: '' },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

pointsLedgerSchema.index({ userId: 1, createdAt: -1 });
pointsLedgerSchema.index({ taskId: 1 });
pointsLedgerSchema.index({ eventId: 1 });
pointsLedgerSchema.index({ source: 1 });
// Unique guard: one event_referral award per (userId, eventId, referralCode)
pointsLedgerSchema.index(
  { userId: 1, eventId: 1, referralCode: 1 },
  { unique: true, sparse: true, partialFilterExpression: { source: 'event_referral' } }
);

const PointsLedger = mongoose.model('PointsLedger', pointsLedgerSchema);
module.exports = { PointsLedger, LEDGER_TYPE, LEDGER_SOURCE };