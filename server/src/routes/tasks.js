const express = require('express');
const mongoose = require('mongoose');
const { Task } = require('../models/Task');
const { User } = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const { requireRole, blockFacultyWrite } = require('../middleware/rbac');
const { requireTeamScope } = require('../middleware/teamScope');
const { validate, taskSchema } = require('../validators/schemas');

const router = express.Router();
router.use(verifyToken);
router.use(blockFacultyWrite);

// GET /api/tasks
router.get('/', async (req, res, next) => {
  try {
    const { role, teamId, id: userId } = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    let filter = {};
    if (role === 'teamleader') {
      filter.teamId = teamId;
    } else if (role === 'volunteer' || role === 'member' || role === 'campus_ambassador') {
      filter.assignees = userId;
    }
    // admin and faculty see all

    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.teamId && role === 'admin') filter.teamId = req.query.teamId;
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .populate('teamId', 'name color')
        .populate('assignees', 'name email role')
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Task.countDocuments(filter),
    ]);

    res.json({ success: true, tasks, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

// GET /api/tasks/:id
router.get('/:id', async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('teamId', 'name color')
      .populate('assignees', 'name email role')
      .populate('createdBy', 'name');
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    // Volunteers can only see their assigned tasks
    const { role, id: userId } = req.user;
    if ((role === 'volunteer' || role === 'member' || role === 'campus_ambassador') &&
        !task.assignees.some((a) => a._id.toString() === userId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    res.json({ success: true, task });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks
router.post('/', requireRole('admin', 'teamleader'), validate(taskSchema), requireTeamScope, async (req, res, next) => {
  try {
    const { role, teamId, id } = req.user;
    const body = { ...req.body, createdBy: id };
    if (role === 'teamleader') body.teamId = teamId; // Force team for TL
    const task = await Task.create(body);
    await task.populate(['teamId', 'assignees', 'createdBy']);
    res.status(201).json({ success: true, task });
  } catch (err) {
    next(err);
  }
});

// PUT /api/tasks/:id
router.put('/:id', requireRole('admin', 'teamleader'), async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    // TL can only edit their team's tasks — use direct DB ownership check
    if (req.user.role === 'teamleader') {
      const owned = await Task.exists({ _id: req.params.id, teamId: req.user.teamId });
      if (!owned) return res.status(403).json({ success: false, message: 'You can only edit your team tasks' });
    }

    const allowed = ['title', 'description', 'assignees', 'deadline', 'priority', 'basePoints', 'status'];
    const update = {};
    allowed.forEach((f) => { if (req.body[f] !== undefined) update[f] = req.body[f]; });

    const updated = await Task.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('teamId', 'name color')
      .populate('assignees', 'name email role')
      .populate('createdBy', 'name');
    res.json({ success: true, task: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', requireRole('admin', 'teamleader'), async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    // TL can only delete their team's tasks — use direct DB ownership check
    if (req.user.role === 'teamleader') {
      const owned = await Task.exists({ _id: req.params.id, teamId: req.user.teamId });
      if (!owned) return res.status(403).json({ success: false, message: 'You can only delete your team tasks' });
    }

    await Task.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Task deleted' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tasks/:id/close — TL or Admin force-closes a task
router.patch('/:id/close', requireRole('admin', 'teamleader'), async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    if (req.user.role === 'teamleader') {
      const owned = await Task.exists({ _id: req.params.id, teamId: req.user.teamId });
      if (!owned) return res.status(403).json({ success: false, message: 'You can only close your team tasks' });
    }

    if (task.status === 'closed') {
      return res.status(400).json({ success: false, message: 'Task is already closed' });
    }

    task.status = 'closed';
    task.closedAt = new Date();
    task.closedBy = req.user.id;
    task.closeNote = req.body.closeNote || null;
    await task.save();

    const updated = await Task.findById(task._id)
      .populate('teamId', 'name color')
      .populate('assignees', 'name email role')
      .populate('createdBy', 'name')
      .populate('closedBy', 'name');

    res.json({ success: true, task: updated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;