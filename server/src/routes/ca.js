const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { Referral } = require('../models/Referral');
const { User } = require('../models/EnhancedUser');
const { PointsLedger } = require('../models/PointsLedger');
const mongoose = require('mongoose');

// Apply auth middleware to all CA routes
router.use(verifyToken);
// NOTE: global requireRole('campus_ambassador') REMOVED here so that /points-leaderboard
// and /leaderboard can be reached by admin/faculty. Each CA-only route has its own guard.

// GET /api/ca/me
// Returns referralCode, basic stats, and total event-referral points (Marketing CAs only)
router.get('/me', requireRole('campus_ambassador'), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .select('name email role referralCode referralCount teamId')
      .populate('teamId', 'name color');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Check if user is in Marketing team
    const isMarketingCA = user.teamId && user.teamId.name === 'Marketing' && user.role === 'campus_ambassador';
    
    let referralInfo = null;
    if (isMarketingCA) {
      // Ensure referral code exists for Marketing CAs
      if (!user.referralCode) {
        user.referralCode = user.generateReferralCode();
        await user.save();
      }

      const [stats, pointsAgg] = await Promise.all([
        Referral.getStatsForUser(req.user.id),
        PointsLedger.aggregate([
          { $match: { userId: new mongoose.Types.ObjectId(req.user.id), source: 'event_referral' } },
          { $group: { _id: null, total: { $sum: '$points' } } },
        ]),
      ]);

      const transformedStats = { pending: 0, confirmed: 0, rejected: 0, expired: 0, total: 0 };
      stats.forEach(stat => {
        transformedStats[stat._id] = stat.count;
        transformedStats.total += stat.count;
      });

      const totalPoints = pointsAgg[0]?.total ?? 0;

      referralInfo = {
        code: user.referralCode,
        totalReferrals: transformedStats.total,
        confirmedReferrals: transformedStats.confirmed,
        pendingReferrals: transformedStats.pending,
        conversionRate: transformedStats.total > 0 ? Math.round((transformedStats.confirmed / transformedStats.total) * 100) : 0,
        totalPoints,
      };
    }

    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        teamId: user.teamId,
        referralInfo: referralInfo,
        isMarketingCA: isMarketingCA
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/ca/referrals
// Paginated list of people referred by this CA
router.get('/referrals', requireRole('campus_ambassador'), async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const status = req.query.status || null;

    const matchQuery = { referrerId: new mongoose.Types.ObjectId(req.user.id) };
    if (status) matchQuery.status = status;

    const referrals = await Referral.find(matchQuery)
      .populate('referredUserId', 'name email avatarUrl')
      .sort({ referredAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Referral.countDocuments(matchQuery);

    res.json({
      success: true,
      referrals: referrals.map(r => ({
        _id: r._id,
        status: r.status,
        createdAt: r.createdAt,
        confirmedAt: r.confirmedAt,
        referralCode: r.referralCode,
        referredUser: r.referredUserId ? {
          _id: r.referredUserId._id,
          name: r.referredUserId.name,
          email: r.referredUserId.email,
          avatarUrl: r.referredUserId.avatarUrl,
        } : null,
        rewardPoints: r.rewardPoints,
        rewardClaimed: r.rewardClaimed,
        daysSinceReferral: r.daysSinceReferral,
        isExpired: r.isExpired,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/ca/analytics
// Totals + last 7/30 days + conversion rate
router.get('/analytics', requireRole('campus_ambassador'), async (req, res, next) => {
  try {
    const now = new Date();
    const last7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalReferred,
      confirmedReferred,
      last7Referred,
      last30Referred,
      last7Confirmed,
      last30Confirmed,
    ] = await Promise.all([
      Referral.countDocuments({ referrerId: req.user.id }),
      Referral.countDocuments({ referrerId: req.user.id, status: 'confirmed' }),
      Referral.countDocuments({ referrerId: req.user.id, referredAt: { $gte: last7 } }),
      Referral.countDocuments({ referrerId: req.user.id, referredAt: { $gte: last30 } }),
      Referral.countDocuments({ referrerId: req.user.id, status: 'confirmed', confirmedAt: { $gte: last7 } }),
      Referral.countDocuments({ referrerId: req.user.id, status: 'confirmed', confirmedAt: { $gte: last30 } }),
    ]);

    const conversionRate = totalReferred > 0 ? Math.round((confirmedReferred / totalReferred) * 100) : 0;
    const last7Conversion = last7Referred > 0 ? Math.round((last7Confirmed / last7Referred) * 100) : 0;
    const last30Conversion = last30Referred > 0 ? Math.round((last30Confirmed / last30Referred) * 100) : 0;

    res.json({
      success: true,
      analytics: {
        total: { referred: totalReferred, confirmed: confirmedReferred, conversionRate: conversionRate },
        last7Days: { referred: last7Referred, confirmed: last7Confirmed, conversionRate: last7Conversion },
        last30Days: { referred: last30Referred, confirmed: last30Confirmed, conversionRate: last30Conversion },
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/ca/points
// Paginated event-referral points ledger for the logged-in CA
router.get('/points', requireRole('campus_ambassador'), async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const matchQuery = {
      userId: new mongoose.Types.ObjectId(req.user.id),
      source: 'event_referral',
    };

    const [ledger, total, totalAgg] = await Promise.all([
      PointsLedger.find(matchQuery)
        .populate('eventId', 'name isFlagship date')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      PointsLedger.countDocuments(matchQuery),
      PointsLedger.aggregate([
        { $match: matchQuery },
        { $group: { _id: null, total: { $sum: '$points' } } },
      ]),
    ]);

    res.json({
      success: true,
      totalPoints: totalAgg[0]?.total ?? 0,
      ledger: ledger.map(e => ({
        _id: e._id,
        points: e.points,
        reason: e.reason,
        referralCode: e.referralCode,
        createdAt: e.createdAt,
        event: e.eventId ? {
          _id: e.eventId._id,
          name: e.eventId.name,
          isFlagship: e.eventId.isFlagship,
          date: e.eventId.date,
        } : null,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/ca/points-leaderboard
// Admin/Faculty view: all CAs ranked by total event-referral points
router.get(
  '/points-leaderboard',
  requireRole('admin', 'faculty', 'teamleader'),
  async (req, res, next) => {
    try {
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));

      const leaderboard = await PointsLedger.aggregate([
        { $match: { source: 'event_referral' } },
        {
          $group: {
            _id: '$userId',
            totalPoints: { $sum: '$points' },
            totalRegistrations: { $sum: 1 },
            flagshipRegistrations: {
              $sum: { $cond: [{ $gte: ['$points', 50] }, 1, 0] },
            },
            lastEarned: { $max: '$createdAt' },
          },
        },
        { $sort: { totalPoints: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'ca',
          },
        },
        { $unwind: '$ca' },
        {
          $lookup: {
            from: 'teams',
            localField: 'ca.teamId',
            foreignField: '_id',
            as: 'team',
          },
        },
        { $unwind: { path: '$team', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            caId: '$_id',
            name: '$ca.name',
            email: '$ca.email',
            referralCode: '$ca.referralCode',
            teamName: '$team.name',
            totalPoints: 1,
            totalRegistrations: 1,
            flagshipRegistrations: 1,
            lastEarned: 1,
          },
        },
      ]);

      const ranked = leaderboard.map((entry, i) => ({ ...entry, rank: i + 1 }));
      res.json({ success: true, leaderboard: ranked });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/ca/leaderboard
// Top CAs by confirmed referrals (admin/faculty view)
router.get('/leaderboard', async (req, res, next) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const leaderboard = await Referral.getLeaderboard(limit);
    res.json({ success: true, leaderboard });
  } catch (err) {
    next(err);
  }
});

module.exports = router;