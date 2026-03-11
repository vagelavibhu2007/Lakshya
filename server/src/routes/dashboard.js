const express = require('express');
const mongoose = require('mongoose');
const { Task } = require('../models/Task');
const { User } = require('../models/User');
const { Submission } = require('../models/Submission');
const { PointsLedger } = require('../models/PointsLedger');
const { Announcement } = require('../models/Announcement');
const { Resource } = require('../models/Resource');
const { Event } = require('../models/Event');
const Team = require('../models/Team');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();
router.use(verifyToken);

// GET /api/dashboard/admin
router.get('/admin', requireRole('admin'), async (req, res, next) => {
  try {
    const [
      totalUsers, totalTeams, totalTasks, totalEvents,
      tasksByStatus, pointsByTeam, topVolunteers,
      recentAnnouncements, recentResources,
    ] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Team.countDocuments(),
      Task.countDocuments(),
      Event.countDocuments({ isActive: true }),
      Task.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      PointsLedger.aggregate([
        { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $lookup: { from: 'teams', localField: 'user.teamId', foreignField: '_id', as: 'team' } },
        { $unwind: { path: '$team', preserveNullAndEmptyArrays: true } },
        { $group: { _id: '$user.teamId', teamName: { $first: '$team.name' }, totalPoints: { $sum: '$points' } } },
        { $sort: { totalPoints: -1 } },
      ]),
      PointsLedger.aggregate([
        { $group: { _id: '$userId', total: { $sum: '$points' } } },
        { $sort: { total: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $project: { name: '$user.name', email: '$user.email', role: '$user.role', total: 1 } },
      ]),
      Announcement.find().sort({ createdAt: -1 }).limit(5).populate('createdBy', 'name'),
      Resource.find().sort({ createdAt: -1 }).limit(5).populate('uploadedBy', 'name'),
    ]);

    const taskStatusMap = {};
    tasksByStatus.forEach((t) => { taskStatusMap[t._id] = t.count; });

    const tasksByTeam = await Task.aggregate([
      { $group: { _id: { teamId: '$teamId', status: '$status' }, count: { $sum: 1 } } },
      { $lookup: { from: 'teams', localField: '_id.teamId', foreignField: '_id', as: 'team' } },
      { $unwind: '$team' },
      { $project: { teamId: '$_id.teamId', teamName: '$team.name', status: '$_id.status', count: 1, _id: 0 } },
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers, totalTeams, totalTasks, totalEvents,
        tasksByStatus: taskStatusMap,
        tasksByTeam,
        pointsByTeam,
        topVolunteers,
        recentAnnouncements,
        recentResources,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/teamleader
router.get('/teamleader', requireRole('admin', 'teamleader'), async (req, res, next) => {
  try {
    const teamId = req.user.role === 'admin' ? req.query.teamId : req.user.teamId;
    if (!teamId) return res.status(400).json({ success: false, message: 'No team assigned' });

    const teamObjId = mongoose.Types.ObjectId.createFromHexString(teamId.toString());

    const [team, members, tasksByStatus, recentSubmissions, topMembers, pendingSubmissions] = await Promise.all([
      Team.findById(teamId).populate('teamLeads', 'name'),
      User.find({ teamId, isActive: true }).select('name email role'),
      Task.aggregate([
        { $match: { teamId: teamObjId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Submission.find()
        .populate({ path: 'taskId', match: { teamId: teamObjId }, select: 'title teamId' })
        .populate('submittedBy', 'name role')
        .sort({ createdAt: -1 })
        .limit(10),
      PointsLedger.aggregate([
        {
          $lookup: {
            from: 'users', localField: 'userId', foreignField: '_id', as: 'user',
          },
        },
        { $unwind: '$user' },
        { $match: { 'user.teamId': teamObjId } },
        { $group: { _id: '$userId', total: { $sum: '$points' }, name: { $first: '$user.name' } } },
        { $sort: { total: -1 } },
        { $limit: 5 },
      ]),
      // Direct DB count: pending (unverified) submissions for this team's tasks
      Task.find({ teamId: teamObjId }).distinct('_id').then((taskIds) =>
        Submission.countDocuments({ taskId: { $in: taskIds }, status: 'pending' })
      ),
    ]);

    const statusMap = {};
    tasksByStatus.forEach((t) => { statusMap[t._id] = t.count; });

    res.json({
      success: true,
      stats: {
        team,
        members,
        tasksByStatus: statusMap,
        recentSubmissions: recentSubmissions.filter((s) => s.taskId),
        topMembers,
        pendingSubmissions,
      },
    });

  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/faculty
router.get('/faculty', requireRole('admin', 'faculty'), async (req, res, next) => {
  try {
    const [teams, tasksByTeam, pointsByTeam, events] = await Promise.all([
      Team.find().populate('teamLeads', 'name'),
      Task.aggregate([
        { $group: { _id: { teamId: '$teamId', status: '$status' }, count: { $sum: 1 } } },
        { $lookup: { from: 'teams', localField: '_id.teamId', foreignField: '_id', as: 'team' } },
        { $unwind: { path: '$team', preserveNullAndEmptyArrays: true } },
        { $project: { teamName: '$team.name', status: '$_id.status', count: 1, _id: 0 } },
      ]),
      PointsLedger.aggregate([
        { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $lookup: { from: 'teams', localField: 'user.teamId', foreignField: '_id', as: 'team' } },
        { $unwind: { path: '$team', preserveNullAndEmptyArrays: true } },
        { $group: { _id: '$user.teamId', teamName: { $first: '$team.name' }, totalPoints: { $sum: '$points' } } },
        { $sort: { totalPoints: -1 } },
      ]),
      Event.find({ isActive: true }).populate('teamId', 'name').sort({ date: 1 }).limit(10),
    ]);

    res.json({
      success: true,
      stats: { teams, tasksByTeam, pointsByTeam, upcomingEvents: events },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;