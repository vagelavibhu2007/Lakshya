const express = require('express');
const { Attendance } = require('../models/Attendance');
const { User } = require('../models/User');
const { Task } = require('../models/Task');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();
router.use(verifyToken);

// Helper: get the date-only Date object (strip time)
const dayDate = (d) => {
  const dt = new Date(d);
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
};

// Helper: ensure TL can only touch their own team
const assertTeamAccess = (req, teamId) => {
  if (req.user.role === 'admin') return true;
  return String(req.user.teamId) === String(teamId);
};

// GET /api/attendance — list records (Admin: all, TL: own team, Faculty: all readonly)
router.get('/', requireRole('admin', 'teamleader', 'faculty'), async (req, res, next) => {
  try {
    const { teamId, startDate, endDate, date } = req.query;
    const filter = {};

    // TL restricted to own team
    if (req.user.role === 'teamleader') {
      filter.teamId = req.user.teamId;
    } else if (teamId) {
      filter.teamId = teamId;
    }

    if (date) {
      const d = dayDate(date);
      filter.date = d;
    } else {
      if (startDate) filter.date = { ...filter.date, $gte: dayDate(startDate) };
      if (endDate) filter.date = { ...filter.date, $lte: dayDate(endDate) };
    }

    const records = await Attendance.find(filter)
      .populate('teamId', 'name color')
      .populate('markedBy', 'name')
      .populate('presentMembers', 'name email role')
      .populate('taskId', 'title')
      .sort({ date: -1 })
      .limit(200);

    res.json({ success: true, records });
  } catch (err) {
    next(err);
  }
});

// GET /api/attendance/summary — aggregate stats
router.get('/summary', requireRole('admin', 'teamleader', 'faculty'), async (req, res, next) => {
  try {
    const teamIdFilter = req.user.role === 'teamleader' ? req.user.teamId : req.query.teamId || null;
    const match = teamIdFilter ? { teamId: new require('mongoose').Types.ObjectId(teamIdFilter) } : {};

    const stats = await Attendance.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$teamId',
          totalDays: { $sum: 1 },
          avgPresent: { $avg: { $size: '$presentMembers' } },
        },
      },
      { $lookup: { from: 'teams', localField: '_id', foreignField: '_id', as: 'team' } },
      { $unwind: '$team' },
      { $project: { teamName: '$team.name', teamColor: '$team.color', totalDays: 1, avgPresent: { $round: ['$avgPresent', 1] } } },
    ]);

    res.json({ success: true, stats });
  } catch (err) {
    next(err);
  }
});

// GET /api/attendance/student/:userId — all attendance for a student
router.get('/student/:userId', requireRole('admin', 'faculty', 'teamleader', 'volunteer', 'member', 'campus_ambassador'), async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Members/Volunteers can only access their own
    if ((req.user.role === 'volunteer' || req.user.role === 'member' || req.user.role === 'campus_ambassador') && req.user.id !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    // TL can only see students in their team
    if (req.user.role === 'teamleader') {
      const student = await User.findById(userId).select('teamId');
      if (!student || String(student.teamId) !== String(req.user.teamId)) {
        return res.status(403).json({ success: false, message: 'Student not in your team' });
      }
    }

    const { startDate, endDate } = req.query;
    const filter = { presentMembers: userId };
    if (startDate) filter.date = { $gte: dayDate(startDate) };
    if (endDate) filter.date = { ...filter.date, $lte: dayDate(endDate) };

    const records = await Attendance.find(filter)
      .populate('teamId', 'name color')
      .populate('markedBy', 'name')
      .populate('taskId', 'title')
      .sort({ date: -1 });

    const student = await User.findById(userId).select('name email role');
    res.json({ success: true, student, records, totalPresent: records.length });
  } catch (err) {
    next(err);
  }
});

// POST /api/attendance — create or update attendance for a team on a date (upsert)
router.post('/', requireRole('admin', 'teamleader'), async (req, res, next) => {
  try {
    const { teamId, date, presentMembers, taskId, notes } = req.body;

    if (!teamId || !date) {
      return res.status(400).json({ success: false, message: 'teamId and date are required' });
    }
    if (!assertTeamAccess(req, teamId)) {
      return res.status(403).json({ success: false, message: 'You can only mark attendance for your own team' });
    }

    const parsedDate = dayDate(date);
    if (parsedDate > new Date() && req.user.role !== 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot mark attendance for future dates' });
    }

    const record = await Attendance.findOneAndUpdate(
      { teamId, date: parsedDate },
      {
        $set: {
          markedBy: req.user.id,
          presentMembers: presentMembers || [],
          taskId: taskId || null,
          notes: notes || '',
        },
      },
      { upsert: true, new: true }
    )
      .populate('teamId', 'name color')
      .populate('markedBy', 'name')
      .populate('presentMembers', 'name email role')
      .populate('taskId', 'title');

    res.status(201).json({ success: true, record });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/attendance/:id — update existing record
router.patch('/:id', requireRole('admin', 'teamleader'), async (req, res, next) => {
  try {
    const record = await Attendance.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });

    if (!assertTeamAccess(req, record.teamId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { presentMembers, taskId, notes } = req.body;
    if (presentMembers !== undefined) record.presentMembers = presentMembers;
    if (taskId !== undefined) record.taskId = taskId || null;
    if (notes !== undefined) record.notes = notes;
    record.markedBy = req.user.id;
    await record.save();

    await record.populate([
      { path: 'teamId', select: 'name color' },
      { path: 'markedBy', select: 'name' },
      { path: 'presentMembers', select: 'name email role' },
      { path: 'taskId', select: 'title' },
    ]);

    res.json({ success: true, record });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/attendance/:id
router.delete('/:id', requireRole('admin', 'teamleader'), async (req, res, next) => {
  try {
    const record = await Attendance.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });

    if (!assertTeamAccess(req, record.teamId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await Attendance.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    next(err);
  }
});

// GET /api/attendance/members/:teamId — get all team members for checklist
router.get('/members/:teamId', requireRole('admin', 'teamleader', 'faculty'), async (req, res, next) => {
  try {
    const { teamId } = req.params;
    if (!assertTeamAccess(req, teamId) && req.user.role !== 'faculty') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const members = await User.find({ teamId, isActive: true }).select('name email role');
    res.json({ success: true, members });
  } catch (err) {
    next(err);
  }
});

module.exports = router;