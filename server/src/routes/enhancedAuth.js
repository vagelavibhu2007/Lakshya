const express = require('express');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { User } = require('../models/EnhancedUser');
const { PasswordResetToken } = require('../models/PasswordResetToken');
const { verifyToken } = require('../middleware/auth');
const {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  compareToken,
  verifyRefreshToken,
} = require('../utils/tokenUtils');
const { validate, loginSchema, forgotPasswordSchema, resetPasswordSchema } = require('../validators/schemas');
const { sendPasswordResetEmail, sendEmailVerificationEmail } = require('../utils/emailService');
const logger = require('../config/logger');

const router = express.Router();

// Rate limiting for different endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { success: false, message: 'Too many requests, please try again later' },
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { success: false, message: 'Too many password reset attempts, please try again later' },
});

// POST /api/auth/login
router.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Find user with team population
    const user = await User.findOne({ email })
      .populate('teamId', 'name color teamLeads')
      .populate('secondaryTeamIds', 'name color')
      .populate('managedTeams', 'name color')
      .populate('referredBy', 'name email');
    
    if (!user || !user.isActive) {
      logger.warn(`Login attempt for inactive/non-existent user: ${email}`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    const valid = await user.comparePassword(password);
    if (!valid) {
      logger.warn(`Invalid password attempt for user: ${email}`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Update login tracking
    user.lastLogin = new Date();
    user.loginCount += 1;
    await user.save();

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user._id);
    user.refreshTokenHash = await hashToken(refreshToken);
    await user.save();

    // Set refresh token cookie
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    logger.info(`User logged in: ${user.email} (${user.role})`);
    
    res.json({
      success: true,
      accessToken,
      user: user.toSafeObject(),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', passwordResetLimiter, validate(forgotPasswordSchema), async (req, res, next) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists for security
      return res.json({ 
        success: true, 
        message: 'If an account with that email exists, a password reset link has been sent.' 
      });
    }

    // Invalidate any existing reset tokens
    await PasswordResetToken.updateMany(
      { userId: user._id, usedAt: null },
      { usedAt: new Date() }
    );

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = await bcrypt.hash(resetToken, 12);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save reset token
    await PasswordResetToken.create({
      userId: user._id,
      tokenHash: resetTokenHash,
      expiresAt,
      requestedByIp: req.ip,
      requestedByUa: req.get('User-Agent'),
    });

    // Send reset email
    await sendPasswordResetEmail(user.email, resetToken, user.name);
    
    logger.info(`Password reset requested for user: ${user.email}`);
    
    res.json({ 
      success: true, 
      message: 'If an account with that email exists, a password reset link has been sent.' 
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token) {
      return res.status(400).json({ success: false, message: 'Reset token is required' });
    }

    // Find valid reset token
    const resetTokens = await PasswordResetToken.find({
      usedAt: null,
      expiresAt: { $gt: new Date() }
    });

    let validToken = null;
    for (const resetToken of resetTokens) {
      const isValid = await bcrypt.compare(token, resetToken.tokenHash);
      if (isValid) {
        validToken = resetToken;
        break;
      }
    }

    if (!validToken) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    // Get user
    const user = await User.findById(validToken.userId);
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    // Validate new password strength
    const strongRe = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+=\-~`|{}\[\]:;"'<>,.\/\\]).{8,}$/;
    if (!strongRe.test(newPassword)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character' 
      });
    }

    // Update password
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();

    // Mark token as used
    validToken.usedAt = new Date();
    await validToken.save();

    // Invalidate all refresh tokens for this user
    user.refreshTokenHash = null;
    await user.save();

    logger.info(`Password reset completed for user: ${user.email}`);
    
    res.json({ success: true, message: 'Password reset successfully. Please login with your new password.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/verify-email
router.post('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ success: false, message: 'Verification token is required' });
    }

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification token' });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    logger.info(`Email verified for user: ${user.email}`);
    
    res.json({ success: true, message: 'Email verified successfully' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', async (req, res, next) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ success: false, message: 'Email is already verified' });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = expiresAt;
    await user.save();

    // Send verification email
    await sendEmailVerificationEmail(user.email, verificationToken, user.name);
    
    logger.info(`Email verification resent for user: ${user.email}`);
    
    res.json({ success: true, message: 'Verification email sent' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ success: false, message: 'No refresh token' });

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    const user = await User.findById(payload.id)
      .populate('teamId', 'name color teamLeads')
      .populate('secondaryTeamIds', 'name color')
      .populate('managedTeams', 'name color')
      .populate('referredBy', 'name email');
      
    if (!user || !user.isActive || !user.refreshTokenHash) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }

    const valid = await compareToken(token, user.refreshTokenHash);
    if (!valid) return res.status(401).json({ success: false, message: 'Refresh token mismatch' });

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user._id);
    user.refreshTokenHash = await hashToken(newRefreshToken);
    await user.save();

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ success: true, accessToken: newAccessToken });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', verifyToken, async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { refreshTokenHash: null });
    res.clearCookie('refreshToken');
    logger.info(`User logged out: ${req.user.email}`);
    res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('teamId', 'name color teamLeads')
      .populate('secondaryTeamIds', 'name color')
      .populate('managedTeams', 'name color')
      .populate('referredBy', 'name email')
      .select('-passwordHash -refreshTokenHash -emailVerificationToken');
      
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/profile
router.put('/profile', verifyToken, async (req, res, next) => {
  try {
    const { name, email, phone, department, year, college } = req.body; 
    const update = {};
    
    if (name) update.name = name;
    if (phone !== undefined) update.phone = phone || null;
    if (department) update.department = department;
    if (year) update.year = year;
    if (college) update.college = college;
    
    if (email) {
      const existing = await User.findOne({ email, _id: { $ne: req.user.id } });
      if (existing) return res.status(400).json({ success: false, message: 'Email already exists' });
      update.email = email;
      update.isEmailVerified = false; // Require re-verification for email change
    }

    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true })
      .populate('teamId', 'name color teamLeads')
      .populate('referredBy', 'name email')
      .select('-passwordHash -refreshTokenHash -emailVerificationToken');
      
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/change-password
router.post('/change-password', verifyToken, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }
    
    // Enforce strong password
    const strongRe = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+=\-~`|{}\[\]:;"'<>,.\/\\]).{8,}$/;
    if (!strongRe.test(newPassword)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character' 
      });
    }
    
    const user = await User.findById(req.user.id);
    const valid = await user.comparePassword(currentPassword);
    if (!valid) return res.status(400).json({ success: false, message: 'Incorrect current password' });
    
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    
    logger.info(`Password changed for user: ${user.email}`);
    
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/managed-teams
router.get('/managed-teams', verifyToken, async (req, res, next) => {
  try {
    const Team = require('../models/Team');
    const teams = await Team.find({ teamLeads: req.user.id }).select('name color');
    res.json({ success: true, teams });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/switch-team
router.post('/switch-team', verifyToken, async (req, res, next) => {
  try {
    const { teamId } = req.body;
    if (!teamId) return res.status(400).json({ success: false, message: 'Team ID is required' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const Team = require('../models/Team');
    // Verify user is a lead of the target team OR has it as a secondary team OR it is their current team
    const isLead = await Team.findOne({ _id: teamId, teamLeads: req.user.id });
    const isSecondary = user.secondaryTeamIds.some(id => id.toString() === teamId);
    
    if (!isLead && !isSecondary && user.teamId.toString() !== teamId) {
      return res.status(403).json({ success: false, message: 'Access denied: You do not have access to this team' });
    }

    const oldTeamId = user.teamId;
    if (oldTeamId.toString() !== teamId) {
        // If switching to a secondary team, ensure the old one replaces it in the secondary pool
        if (isSecondary) {
            user.secondaryTeamIds = user.secondaryTeamIds.filter(id => id.toString() !== teamId);
            if (!user.secondaryTeamIds.some(id => id.toString() === oldTeamId.toString())) {
                user.secondaryTeamIds.push(oldTeamId);
            }
        }
        user.teamId = teamId;
        await user.save();
    }

    const updatedUser = await User.findById(req.user.id)
      .populate('teamId', 'name color teamLeads')
      .populate('secondaryTeamIds', 'name color')
      .populate('managedTeams', 'name color')
      .populate('referredBy', 'name email');

    if (!updatedUser) return res.status(404).json({ success: false, message: 'User not found' });

    // Generate new access token with updated teamId
    const accessToken = generateAccessToken(updatedUser);
    
    logger.info(`User ${updatedUser.email} switched active team to ${teamId}`);

    res.json({
      success: true,
      accessToken,
      user: updatedUser.toSafeObject(),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;