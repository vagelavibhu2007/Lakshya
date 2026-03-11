const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Team = require('./Team');

const ROLES = ['admin', 'teamleader', 'faculty', 'member', 'volunteer', 'campus_ambassador']; // Renamed volunteer → member

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ROLES,
      required: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    secondaryTeamIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
      },
    ],
    isActive: { type: Boolean, default: true },
    avatarUrl: { type: String, default: null },
    phone: { type: String, default: null },
    refreshTokenHash: { type: String, default: null },
    
    // Campus Ambassador specific fields
    referralCode: { type: String, unique: true, sparse: true },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    referralCount: { type: Number, default: 0 },
    
    // Profile enhancement
    department: { type: String, default: null },
    year: { type: Number, min: 1, max: 5, default: null },
    college: { type: String, default: null },
    
    // System fields
    lastLogin: { type: Date, default: null },
    loginCount: { type: Number, default: 0 },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, default: null },
    emailVerificationExpires: { type: Date, default: null },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for all teams this user belongs to
userSchema.virtual('allTeams', {
  ref: 'Team',
  localField: 'teamId',
  foreignField: '_id',
  justOne: false,
});

// Virtual for teams where this user is a lead
userSchema.virtual('managedTeams', {
  ref: 'Team',
  localField: '_id',
  foreignField: 'teamLeads'
});

// Enhanced indexes for performance
userSchema.index({ teamId: 1 });
userSchema.index({ secondaryTeamIds: 1 });
userSchema.index({ role: 1 });
userSchema.index({ referredBy: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

// Password comparison method
userSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

// Safe object method (excludes sensitive data)
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.refreshTokenHash;
  delete obj.emailVerificationToken;
  return obj;
};

// Generate referral code method
userSchema.methods.generateReferralCode = function() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

userSchema.methods.generateUniqueReferralCode = async function(maxAttempts = 10) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = this.generateReferralCode();
    // Use the already-compiled model to avoid OverwriteModelError
    const ExistingUserModel = mongoose.models.User;
    const exists = await ExistingUserModel.exists({ referralCode: code });
    if (!exists) return code;
  }
  throw new Error('Failed to generate unique referral code');
};

// Pre-save middleware for referral code generation
userSchema.pre('save', async function(next) {
  // Generate referral code for Campus Ambassadors in Marketing or Online Marketing team
  try {
    const isCA = this.role === 'campus_ambassador';
    const teamChangedOrRoleChanged = this.isModified('teamId') || this.isModified('role');

    if (teamChangedOrRoleChanged && isCA && !this.referralCode && this.teamId) {
      const team = await Team.findById(this.teamId).select('name');
      if (team && (team.name === 'Marketing' || team.name === 'Online Marketing')) {
        this.referralCode = await this.generateUniqueReferralCode();
      }
    }
    return next();
  } catch (error) {
    return next(error);
  }
});

const User = mongoose.models.User || mongoose.model('User', userSchema);
module.exports = { User, ROLES };