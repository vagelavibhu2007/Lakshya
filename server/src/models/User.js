const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['admin', 'teamleader', 'faculty', 'member', 'volunteer', 'campus_ambassador'];

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
    isActive: { type: Boolean, default: true, index: true },
    avatarUrl: { type: String, default: null },
    phone: { type: String, default: null },
    refreshTokenHash: { type: String, default: null },
  },
  { timestamps: true }
);

// Indexes
userSchema.index({ teamId: 1 });
userSchema.index({ role: 1 });

userSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.refreshTokenHash;
  return obj;
};

const User = mongoose.models.User || mongoose.model('User', userSchema);
module.exports = { User, ROLES };