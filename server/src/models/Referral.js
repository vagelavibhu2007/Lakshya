const mongoose = require('mongoose');

const REFERRAL_STATUS = ['pending', 'confirmed', 'rejected', 'expired'];

const referralSchema = new mongoose.Schema(
  {
    // Referral relationship
    referrerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    referredUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    referralCode: {
      type: String,
      required: true,
    },
    
    // Referral status and tracking
    status: {
      type: String,
      enum: REFERRAL_STATUS,
      default: 'pending',
    },
    
    // Timestamps
    referredAt: { type: Date, default: Date.now },
    confirmedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    
    // Referral source
    source: { type: String, enum: ['email', 'social', 'whatsapp', 'direct', 'registration', 'other'], default: 'direct' },
    campaign: { type: String, default: null },
    utmSource: { type: String, default: null },
    utmMedium: { type: String, default: null },
    utmCampaign: { type: String, default: null },
    
    // Metadata
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
    notes: { type: String, default: '' },
    
    // Rewards and points
    rewardPoints: { type: Number, default: 0 },
    rewardClaimed: { type: Boolean, default: false },
    rewardClaimedAt: { type: Date, default: null },
    
    // Conversion tracking
    conversionSteps: [{
      step: { type: String, required: true },
      completedAt: { type: Date, default: Date.now },
      metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    }],
  },
  { timestamps: true }
);

// Enhanced indexes for performance
referralSchema.index({ referrerId: 1 });
referralSchema.index({ referredUserId: 1 });
referralSchema.index({ referralCode: 1 });
referralSchema.index({ status: 1 });
referralSchema.index({ referredAt: -1 });
referralSchema.index({ expiresAt: 1 });

// Compound indexes for unique constraints and common queries
referralSchema.index(
  { referrerId: 1, referredUserId: 1 }, 
  { unique: true }
);
referralSchema.index({ referrerId: 1, status: 1 });
referralSchema.index({ referralCode: 1, status: 1 });

// Virtual for days since referral
referralSchema.virtual('daysSinceReferral').get(function() {
  const now = new Date();
  const referredAt = new Date(this.referredAt);
  const diffTime = now - referredAt;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for is expired
referralSchema.virtual('isExpired').get(function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

// Static method to get referral stats for user
referralSchema.statics.getStatsForUser = function(userId) {
  return this.aggregate([
    { $match: { referrerId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalPoints: { $sum: '$rewardPoints' }
      }
    }
  ]);
};

// Static method to get referral leaderboard
referralSchema.statics.getLeaderboard = function(limit = 10) {
  return this.aggregate([
    { $match: { status: 'confirmed' } },
    {
      $group: {
        _id: '$referrerId',
        totalReferrals: { $sum: 1 },
        totalPoints: { $sum: '$rewardPoints' },
        lastReferral: { $max: '$referredAt' }
      }
    },
    { $sort: { totalReferrals: -1, totalPoints: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $project: {
        userId: '$_id',
        name: '$user.name',
        email: '$user.email',
        avatarUrl: '$user.avatarUrl',
        totalReferrals: 1,
        totalPoints: 1,
        lastReferral: 1
      }
    }
  ]);
};

// Pre-save middleware to set expiration date
referralSchema.pre('save', function(next) {
  if (this.isNew && !this.expiresAt) {
    // Set expiration to 30 days from referral
    this.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  next();
});

const Referral = mongoose.models.Referral || mongoose.model('Referral', referralSchema);
module.exports = { Referral, REFERRAL_STATUS };