const express = require('express');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const { User } = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  compareToken,
  verifyRefreshToken,
} = require('../utils/tokenUtils');
const { validate, loginSchema } = require('../validators/schemas');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { success: false, message: 'Too many requests, please try again later' },
});

// POST /api/auth/login
router.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).populate('teamId', 'name color');
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user._id);
    user.refreshTokenHash = await hashToken(refreshToken);
    await user.save();

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      accessToken,
      user: user.toSafeObject(),
    });
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

    const user = await User.findById(payload.id).populate('teamId', 'name color');
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
    res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate('teamId', 'name color teamLeads').select('-passwordHash -refreshTokenHash');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/profile
router.put('/profile', verifyToken, async (req, res, next) => {
  try {
    const { name, email, phone } = req.body; 
    const update = {};
    if (name) update.name = name;
    if (phone !== undefined) update.phone = phone || null;
    if (email) {
      const existing = await User.findOne({ email, _id: { $ne: req.user.id } });
      if (existing) return res.status(400).json({ success: false, message: 'Email already exists' });
      update.email = email;
    }

    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true }).populate('teamId', 'name color teamLeads').select('-passwordHash -refreshTokenHash');
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
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character' });
    }
    const user = await User.findById(req.user.id);
    const valid = await user.comparePassword(currentPassword);
    if (!valid) return res.status(400).json({ success: false, message: 'Incorrect current password' });
    
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;