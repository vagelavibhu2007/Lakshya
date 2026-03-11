const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { Referral } = require('../models/Referral');
const { User } = require('../models/EnhancedUser');

// Apply auth middleware to all referral routes
router.use(verifyToken);

// Simple validation helper
const validateBody = (requiredFields) => {
  return (req, res, next) => {
    const missing = requiredFields.filter(field => !req.body[field]);
    if (missing.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Missing required fields: ${missing.join(', ')}` 
      });
    }
    next();
  };
};

// POST /api/referrals/apply
// Use a referral code during registration or first login
router.post('/apply', validateBody(['referralCode']), async (req, res, next) => {
  try {
    const { referralCode } = req.body;
    const userId = req.user.id;

    // Find the referral code owner
    const referrer = await User.findOne({ referralCode, isActive: true });
    if (!referrer) {
      return res.status(404).json({ success: false, message: 'Invalid referral code' });
    }

    // Prevent self-referral
    if (referrer._id.toString() === userId) {
      return res.status(400).json({ success: false, message: 'Cannot use your own referral code' });
    }

    // Check if user already has a referral
    const existingReferral = await Referral.findOne({ referredUserId: userId });
    if (existingReferral) {
      return res.status(400).json({ success: false, message: 'You already used a referral code' });
    }

    // Check if referrer already referred this user
    const duplicateReferral = await Referral.findOne({ 
      referrerId: referrer._id, 
      referredUserId: userId 
    });
    if (duplicateReferral) {
      return res.status(400).json({ success: false, message: 'This referral already exists' });
    }

    // Create the referral
    const referral = new Referral({
      referrerId: referrer._id,
      referredUserId: userId,
      referralCode,
      status: 'pending',
      source: 'registration',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    await referral.save();

    // Update referrer's referral count
    await User.findByIdAndUpdate(referrer._id, { 
      $inc: { referralCount: 1 } 
    });

    // Update referred user's profile
    await User.findByIdAndUpdate(userId, { 
      referredBy: referrer._id 
    });

    res.json({
      success: true,
      message: 'Referral code applied successfully',
      referral: {
        _id: referral._id,
        referralCode: referral.referralCode,
        status: referral.status,
        referrerName: referrer.name
      }
    });

  } catch (err) {
    next(err);
  }
});

// GET /api/referrals/my-referral
// Get the current user's referral information (if they were referred)
router.get('/my-referral', async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const referral = await Referral.findOne({ referredUserId: userId })
      .populate('referrerId', 'name email referralCode')
      .populate('referredUserId', 'name email');

    if (!referral) {
      return res.json({ 
        success: true, 
        referral: null,
        message: 'No referral found for this user' 
      });
    }

    res.json({
      success: true,
      referral: {
        _id: referral._id,
        status: referral.status,
        referralCode: referral.referralCode,
        referredAt: referral.referredAt,
        confirmedAt: referral.confirmedAt,
        rewardPoints: referral.rewardPoints,
        rewardClaimed: referral.rewardClaimed,
        referrer: referral.referrerId ? {
          _id: referral.referrerId._id,
          name: referral.referrerId.name,
          email: referral.referrerId.email,
          referralCode: referral.referrerId.referralCode
        } : null,
        referredUser: referral.referredUserId ? {
          _id: referral.referredUserId._id,
          name: referral.referredUserId.name,
          email: referral.referredUserId.email
        } : null,
        daysSinceReferral: referral.daysSinceReferral,
        isExpired: referral.isExpired
      }
    });

  } catch (err) {
    next(err);
  }
});

// POST /api/referrals/confirm
// Confirm a referral (can be called by system or admin)
router.post('/confirm', validateBody(['referralId']), async (req, res, next) => {
  try {
    const { referralId, source = 'admin_approval' } = req.body;

    const referral = await Referral.findById(referralId);
    if (!referral) {
      return res.status(404).json({ success: false, message: 'Referral not found' });
    }

    if (referral.status === 'confirmed') {
      return res.status(400).json({ success: false, message: 'Referral already confirmed' });
    }

    if (referral.status === 'rejected' || referral.status === 'expired') {
      return res.status(400).json({ success: false, message: 'Cannot confirm a rejected or expired referral' });
    }

    // Confirm the referral
    referral.status = 'confirmed';
    referral.confirmedAt = new Date();
    referral.source = source;
    await referral.save();

    // Add conversion step
    referral.conversionSteps.push({
      step: 'referral_confirmed',
      completedAt: new Date(),
      metadata: { source, confirmedBy: req.user.id }
    });
    await referral.save();

    // Optionally award points (can be configured based on business logic)
    // referral.rewardPoints = 100; // Example: 100 points for confirmed referral
    // await referral.save();

    res.json({
      success: true,
      message: 'Referral confirmed successfully',
      referral: {
        _id: referral._id,
        status: referral.status,
        confirmedAt: referral.confirmedAt,
        source: referral.source
      }
    });

  } catch (err) {
    next(err);
  }
});

// POST /api/referrals/reject
// Reject a referral (admin only)
router.post('/reject', validateBody(['referralId']), async (req, res, next) => {
  try {
    const { referralId, reason } = req.body;

    const referral = await Referral.findById(referralId);
    if (!referral) {
      return res.status(404).json({ success: false, message: 'Referral not found' });
    }

    if (referral.status === 'confirmed') {
      return res.status(400).json({ success: false, message: 'Cannot reject a confirmed referral' });
    }

    // Reject the referral
    referral.status = 'rejected';
    if (reason) referral.notes = reason;
    await referral.save();

    // Add conversion step
    referral.conversionSteps.push({
      step: 'referral_rejected',
      completedAt: new Date(),
      metadata: { reason, rejectedBy: req.user.id }
    });
    await referral.save();

    // Decrement referrer's referral count
    await User.findByIdAndUpdate(referral.referrerId, { 
      $inc: { referralCount: -1 } 
    });

    // Remove referredBy from user
    await User.findByIdAndUpdate(referral.referredUserId, { 
      $unset: { referredBy: 1 } 
    });

    res.json({
      success: true,
      message: 'Referral rejected successfully',
      referral: {
        _id: referral._id,
        status: referral.status,
        reason: reason
      }
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;