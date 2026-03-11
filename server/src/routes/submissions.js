// const express = require('express');
// const path = require('path');
// const { Task } = require('../models/Task');
// const { Submission } = require('../models/Submission');
// const { PointsLedger } = require('../models/PointsLedger');
// const { verifyToken } = require('../middleware/auth');
// const { requireRole, blockFacultyWrite } = require('../middleware/rbac');
// const { validate, submissionSchema, verifySubmissionSchema } = require('../validators/schemas');
// const upload = require('../config/multer');

// const router = express.Router();
// router.use(verifyToken);

// // POST /api/submissions/:taskId — Volunteer/CA submits proof
// router.post('/:taskId', requireRole('volunteer', 'campus_ambassador'), async (req, res, next) => {
//   try {
//     const task = await Task.findById(req.params.taskId);
//     if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
//     if (!task.assignees.map(String).includes(req.user.id)) {
//       return res.status(403).json({ success: false, message: 'You are not assigned to this task' });
//     }
//     if (task.status === 'verified') {
//       return res.status(400).json({ success: false, message: 'Task already verified' });
//     }

//     const { proofType, proofValue, note } = req.body;
//     if (!proofType || !proofValue) {
//       return res.status(400).json({ success: false, message: 'proofType and proofValue are required' });
//     }

//     const submission = await Submission.create({
//       taskId: task._id,
//       submittedBy: req.user.id,
//       proofType,
//       proofValue,
//       note: note || '',
//     });

//     // Update task status
//     await Task.findByIdAndUpdate(task._id, { status: 'submitted' });

//     res.status(201).json({ success: true, submission });
//   } catch (err) {
//     next(err);
//   }
// });

// // POST /api/submissions/:taskId/file — Volunteer/CA uploads file proof
// router.post('/:taskId/file', requireRole('volunteer', 'campus_ambassador'), upload.single('proof'), async (req, res, next) => {
//   try {
//     if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
//     const task = await Task.findById(req.params.taskId);
//     if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
//     if (!task.assignees.map(String).includes(req.user.id)) {
//       return res.status(403).json({ success: false, message: 'You are not assigned to this task' });
//     }

//     const fileUrl = req.file.path;
//     const submission = await Submission.create({
//       taskId: task._id,
//       submittedBy: req.user.id,
//       proofType: 'file',
//       proofValue: fileUrl,
//       originalFileName: req.file.originalname,
//       note: req.body.note || '',
//     });
//     await Task.findByIdAndUpdate(task._id, { status: 'submitted' });
//     res.status(201).json({ success: true, submission });
//   } catch (err) {
//     next(err);
//   }
// });

// // GET /api/submissions — TL sees their team's, admin sees all, volunteer sees own
// router.get('/', async (req, res, next) => {
//   try {
//     const { role, teamId, id: userId } = req.user;
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 20;
//     const skip = (page - 1) * limit;

//     let filter = {};
//     if (req.query.status) filter.status = req.query.status;
//     if (req.query.taskId) filter.taskId = req.query.taskId;

//     if (role === 'volunteer' || role === 'campus_ambassador') {
//       filter.submittedBy = userId;
//     }

//     let submissions = await Submission.find(filter)
//       .populate({ path: 'taskId', populate: { path: 'teamId', select: 'name _id' }, select: 'title teamId basePoints' })
//       .populate('submittedBy', 'name email role teamId')
//       .populate('verifiedBy', 'name')
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit);

//     // TL: only their team's submissions
//     if (role === 'teamleader') {
//       submissions = submissions.filter(
//         (s) => s.taskId && s.taskId.teamId && s.taskId.teamId._id.toString() === teamId
//       );
//     }

//     const total = await Submission.countDocuments(filter);
//     res.json({ success: true, submissions, total, page, pages: Math.ceil(total / limit) });
//   } catch (err) {
//     next(err);
//   }
// });

// // GET /api/submissions/:id
// router.get('/:id', async (req, res, next) => {
//   try {
//     const sub = await Submission.findById(req.params.id)
//       .populate({ path: 'taskId', populate: { path: 'teamId', select: 'name _id' }, select: 'title teamId basePoints assignees' })
//       .populate('submittedBy', 'name email role')
//       .populate('verifiedBy', 'name');

//     if (!sub) return res.status(404).json({ success: false, message: 'Submission not found' });

//     const { role, teamId, id: userId } = req.user;
//     if ((role === 'volunteer' || role === 'campus_ambassador') && sub.submittedBy._id.toString() !== userId) {
//       return res.status(403).json({ success: false, message: 'Access denied' });
//     }
//     if (role === 'teamleader' && sub.taskId.teamId._id.toString() !== teamId) {
//       return res.status(403).json({ success: false, message: 'Access denied' });
//     }
//     res.json({ success: true, submission: sub });
//   } catch (err) {
//     next(err);
//   }
// });

// // PUT /api/submissions/:id/verify — TL or Admin verifies
// router.put('/:id/verify', requireRole('admin', 'teamleader'), validate(verifySubmissionSchema), async (req, res, next) => {
//   try {
//     const sub = await Submission.findById(req.params.id).populate({
//       path: 'taskId',
//       populate: { path: 'teamId', select: '_id' },
//       select: 'title teamId basePoints status',
//     });
//     if (!sub) return res.status(404).json({ success: false, message: 'Submission not found' });

//     // TL must own the team
//     if (req.user.role === 'teamleader' && sub.taskId.teamId._id.toString() !== req.user.teamId) {
//       return res.status(403).json({ success: false, message: 'You can only verify your team submissions' });
//     }

//     const { awardedPoints, status, rejectionReason } = req.body;

//     sub.status = status;
//     sub.awardedPoints = status === 'verified' ? awardedPoints : 0;
//     sub.verifiedBy = req.user.id;
//     sub.verifiedAt = new Date();
//     sub.rejectionReason = rejectionReason || null;
//     await sub.save();

//     // Update task status
//     await Task.findByIdAndUpdate(sub.taskId._id, { status });

//     // Add to points ledger if verified
//     if (status === 'verified') {
//       await PointsLedger.create({
//         userId: sub.submittedBy,
//         taskId: sub.taskId._id,
//         submissionId: sub._id,
//         points: awardedPoints,
//         type: 'earned',
//         reason: `Verified by ${req.user.name || req.user.email}`,
//         createdBy: req.user.id,
//       });
//     }

//     res.json({ success: true, submission: sub });
//   } catch (err) {
//     next(err);
//   }
// });

// module.exports = router;



const express = require('express');
const path = require('path');
const { Task } = require('../models/Task');
const { Submission } = require('../models/Submission');
const { PointsLedger } = require('../models/PointsLedger');
const { verifyToken } = require('../middleware/auth');
const { requireRole, blockFacultyWrite } = require('../middleware/rbac');
const { validate, submissionSchema, verifySubmissionSchema } = require('../validators/schemas');
const upload = require('../config/multer');

const router = express.Router();
router.use(verifyToken);

// POST /api/submissions/:taskId — Volunteer/CA/Member submits proof
router.post('/:taskId', requireRole('volunteer', 'member', 'campus_ambassador'), async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    if (!task.assignees.map(String).includes(req.user.id)) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this task' });
    }
    // Remove duplicate block completely but prevent verification overrides.
    const existing = await Submission.findOne({
      taskId: task._id,
      submittedBy: req.user.id,
    });
    if (existing && existing.status === 'verified') {
      return res.status(400).json({ success: false, message: 'Your previous submission is already verified.' });
    }

    const { proofType, proofValue, note } = req.body;
    if (!proofType || !proofValue) {
      return res.status(400).json({ success: false, message: 'proofType and proofValue are required' });
    }

    let submission;
    if (existing) {
      existing.proofType = proofType;
      existing.proofValue = proofValue;
      existing.note = note || '';
      existing.status = 'pending';
      existing.rejectionReason = null;
      submission = await existing.save();
    } else {
      submission = await Submission.create({
        taskId: task._id,
        submittedBy: req.user.id,
        proofType,
        proofValue,
        note: note || '',
      });
    }

    // Do not update global task status to allow others to submit
    // await Task.findByIdAndUpdate(task._id, { status: 'submitted' });

    res.status(201).json({ success: true, submission });
  } catch (err) {
    next(err);
  }
});

// POST /api/submissions/:taskId/file — Volunteer/CA/Member uploads file proof
router.post('/:taskId/file', requireRole('volunteer', 'member', 'campus_ambassador'), upload.single('proof'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    if (!task.assignees.map(String).includes(req.user.id)) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this task' });
    }

    // Find existing submission
    const existing = await Submission.findOne({
      taskId: task._id,
      submittedBy: req.user.id,
    });
    if (existing && existing.status === 'verified') {
      return res.status(400).json({ success: false, message: 'Your previous submission is already verified.' });
    }

    // Re-append extension if multer-storage-cloudinary stripped it from the raw URL
    let fileUrl = req.file.path;
    const originalExt = req.file.originalname.split('.').pop().toLowerCase();
    const isDocument =
      req.file.mimetype === 'application/pdf' ||
      req.file.mimetype.includes('document') ||
      req.file.mimetype.includes('text') ||
      req.file.mimetype.includes('csv');
    if (isDocument && !fileUrl.endsWith(`.${originalExt}`)) {
      fileUrl = `${fileUrl}.${originalExt}`;
    }
    let submission;
    if (existing) {
      existing.proofType = 'file';
      existing.proofValue = fileUrl;
      existing.originalFileName = req.file.originalname;
      existing.note = req.body.note || '';
      existing.status = 'pending';
      existing.rejectionReason = null;
      submission = await existing.save();
    } else {
      submission = await Submission.create({
        taskId: task._id,
        submittedBy: req.user.id,
        proofType: 'file',
        proofValue: fileUrl,
        originalFileName: req.file.originalname,
        note: req.body.note || '',
      });
    }
    // Do not update global task status
    // await Task.findByIdAndUpdate(task._id, { status: 'submitted' });
    res.status(201).json({ success: true, submission });
  } catch (err) {
    next(err);
  }
});

// GET /api/submissions — TL sees their team's, admin sees all, volunteer sees own
router.get('/', async (req, res, next) => {
  try {
    const { role, teamId, id: userId } = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    let filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.taskId) filter.taskId = req.query.taskId;

    if (role === 'volunteer' || role === 'member' || role === 'campus_ambassador') {
      filter.submittedBy = userId;
    }

    // For TL: restrict to tasks belonging to their team — do a DB-level query
    if (role === 'teamleader' && teamId) {
      const teamTaskIds = await Task.find({ teamId }).distinct('_id');
      filter.taskId = { $in: teamTaskIds };
    }

    const [submissions, total] = await Promise.all([
      Submission.find(filter)
        .populate({ path: 'taskId', populate: { path: 'teamId', select: 'name _id' }, select: 'title teamId basePoints' })
        .populate('submittedBy', 'name email role')
        .populate('verifiedBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Submission.countDocuments(filter),
    ]);

    res.json({ success: true, submissions, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

// GET /api/submissions/:id
router.get('/:id', async (req, res, next) => {
  try {
    const sub = await Submission.findById(req.params.id)
      .populate({ path: 'taskId', populate: { path: 'teamId', select: 'name _id' }, select: 'title teamId basePoints assignees' })
      .populate('submittedBy', 'name email role')
      .populate('verifiedBy', 'name');

    if (!sub) return res.status(404).json({ success: false, message: 'Submission not found' });

    const { role, teamId, id: userId } = req.user;
    if ((role === 'volunteer' || role === 'member' || role === 'campus_ambassador') && sub.submittedBy._id.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (role === 'teamleader' && sub.taskId.teamId._id.toString() !== teamId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    res.json({ success: true, submission: sub });
  } catch (err) {
    next(err);
  }
});

// PUT /api/submissions/:id/verify — TL or Admin verifies
router.put('/:id/verify', requireRole('admin', 'teamleader'), validate(verifySubmissionSchema), async (req, res, next) => {
  try {
    const sub = await Submission.findById(req.params.id).populate({
      path: 'taskId',
      populate: { path: 'teamId', select: '_id' },
      select: 'title teamId basePoints status assignees',
    });
    if (!sub) return res.status(404).json({ success: false, message: 'Submission not found' });

    // TL must own the team
    if (req.user.role === 'teamleader' && sub.taskId.teamId._id.toString() !== req.user.teamId) {
      return res.status(403).json({ success: false, message: 'You can only verify your team submissions' });
    }

    const { awardedPoints, status, rejectionReason } = req.body;

    sub.status = status;
    sub.awardedPoints = status === 'verified' ? awardedPoints : 0;
    sub.verifiedBy = req.user.id;
    sub.verifiedAt = new Date();
    sub.rejectionReason = rejectionReason || null;
    await sub.save();

    // We no longer update the task status here to avoid blocking other members
    // await Task.findByIdAndUpdate(sub.taskId._id, { status });

    // Award points ONLY to the submitter, and only once (idempotency guard)
    if (status === 'verified') {
      // Guard: skip if points were already awarded for this submission
      const alreadyAwarded = await PointsLedger.exists({ submissionId: sub._id });
      if (!alreadyAwarded) {
        await PointsLedger.create({
          userId: sub.submittedBy,
          taskId: sub.taskId._id,
          submissionId: sub._id,
          points: awardedPoints,
          type: 'earned',
          reason: `Verified by ${req.user.name || req.user.email}`,
          createdBy: req.user.id,
        });
      }
    }

    // Derive overall task status from all submissions for this task
    const task = await Task.findById(sub.taskId._id);
    if (task && task.status !== 'closed') {
      const assigneeIds = task.assignees.map(String);
      const allSubs = await Submission.find({ taskId: task._id });
      
      // Check if every assignee has a verified or rejected submission
      const processedAssignees = new Set();
      allSubs.forEach(s => {
        if (s.status === 'verified' || s.status === 'rejected') {
          processedAssignees.add(s.submittedBy.toString());
        }
      });
      
      const allProcessed = assigneeIds.every(id => processedAssignees.has(id));
      const hasPending = allSubs.some(s => s.status === 'pending');
      
      if (allProcessed) {
        task.status = 'verified';
      } else if (hasPending) {
        task.status = 'submitted';
      }
      // else stays open
      await task.save();
    }

    res.json({ success: true, submission: sub });
  } catch (err) {
    next(err);
  }
});

module.exports = router;