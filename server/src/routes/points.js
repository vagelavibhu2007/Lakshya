const express = require('express');
const { PointsLedger } = require('../models/PointsLedger');
const { User } = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { validate, pointsOverrideSchema } = require('../validators/schemas');

const router = express.Router();
router.use(verifyToken);

// GET /api/points/leaderboard
router.get('/leaderboard', async (req, res, next) => {
  try {
    const { teamId: filterTeam, role: filterRole } = req.query;

    const mongoose = require('mongoose');

    // Aggregate total points starting from Users so 0-point users appear
    const pipeline = [
      {
        $match: {
          role: { $in: ['volunteer', 'member', 'campus_ambassador'] },
          isActive: true,
          ...(filterTeam ? { teamId: mongoose.Types.ObjectId.createFromHexString(filterTeam) } : {}),
          ...(filterRole ? { role: filterRole } : {}),
        },
      },
      {
        $lookup: {
          from: 'pointsledgers', // MongoDB collections are usually lowercase + plural
          localField: '_id',
          foreignField: 'userId',
          as: 'pointsEntries',
        },
      },
      {
        $addFields: {
          totalPoints: { $sum: '$pointsEntries.points' },
        },
      },
      {
        $lookup: {
          from: 'teams',
          localField: 'teamId',
          foreignField: '_id',
          as: 'team',
        },
      },
      { $unwind: { path: '$team', preserveNullAndEmptyArrays: true } },
      { $sort: { totalPoints: -1 } },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          name: 1,
          email: 1,
          role: 1,
          teamId: 1,
          teamName: '$team.name',
          totalPoints: 1,
        },
      },
    ];

    const leaderboard = await User.aggregate(pipeline);
    const ranked = leaderboard.map((entry, i) => ({ ...entry, rank: i + 1 }));

    res.json({ success: true, leaderboard: ranked });
  } catch (err) {
    next(err);
  }
});

// GET /api/points/ledger — Admin sees all, user sees own
router.get('/ledger', async (req, res, next) => {
  try {
    const { role, id: userId } = req.user;
    const targetId = req.query.userId || (role !== 'admin' && role !== 'faculty' && role !== 'teamleader' ? userId : null);
    const filter = targetId ? { userId: targetId } : {};

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const skip = (page - 1) * limit;

    const [ledger, total] = await Promise.all([
      PointsLedger.find(filter)
        .populate('userId', 'name email')
        .populate('taskId', 'title')
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      PointsLedger.countDocuments(filter),
    ]);
    res.json({ success: true, ledger, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

// POST /api/points/override — Admin only
router.post('/override', requireRole('admin'), validate(pointsOverrideSchema), async (req, res, next) => {
  try {
    const { userId, points, reason, taskId } = req.body;
    const entry = await PointsLedger.create({
      userId,
      taskId: taskId || null,
      submissionId: null,
      points,
      type: 'override',
      reason,
      createdBy: req.user.id,
    });
    res.status(201).json({ success: true, entry });
  } catch (err) {
    next(err);
  }
});

// GET /api/points/my — self ledger shortcut
router.get('/my', async (req, res, next) => {
  try {
    const ledger = await PointsLedger.find({ userId: req.user.id })
      .populate('taskId', 'title')
      .sort({ createdAt: -1 });
    const total = ledger.reduce((sum, e) => sum + e.points, 0);
    res.json({ success: true, ledger, totalPoints: total });
  } catch (err) {
    next(err);
  }
});

module.exports = router;