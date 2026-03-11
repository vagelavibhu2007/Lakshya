const mongoose = require('mongoose');

const passwordResetTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    requestedByIp: { type: String, default: null },
    requestedByUa: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// One active (unused) token per user at a time
passwordResetTokenSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { usedAt: null } }
);

// TTL cleanup once expired
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PasswordResetToken = mongoose.model('PasswordResetToken', passwordResetTokenSchema);
module.exports = { PasswordResetToken };