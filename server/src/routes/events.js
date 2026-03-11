const express = require('express');
const { Event } = require('../models/Event');
const { EventRegistration } = require('../models/EventRegistration');
const { PointsLedger } = require('../models/PointsLedger');
const { User } = require('../models/EnhancedUser');
const { POINTS_CONFIG } = require('../config/pointsConfig');
const { verifyToken } = require('../middleware/auth');
const { requireRole, blockFacultyWrite } = require('../middleware/rbac');
const { validate, eventSchema } = require('../validators/schemas');
const upload = require('../config/multer');

const router = express.Router();
router.use(verifyToken);

// GET /api/events
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const filter = {};

    if (req.query.teamId) filter.teamId = req.query.teamId;
    if (req.query.type) filter.type = req.query.type;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

    const [events, total] = await Promise.all([
      Event.find(filter)
        .populate('teamId', 'name color')
        .populate('createdBy', 'name')
        .sort({ date: 1 })
        .skip(skip)
        .limit(limit),
      Event.countDocuments(filter),
    ]);
    res.json({ success: true, events, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

// GET /api/events/:id
router.get('/:id', async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('teamId', 'name color teamLeads')
      .populate('createdBy', 'name');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    res.json({ success: true, event });
  } catch (err) {
    next(err);
  }
});

const canManageEvent = async (req, eventId) => {
  const event = await Event.findById(eventId).select('teamId');
  if (!event) return { ok: false, status: 404, message: 'Event not found' };
  if (req.user.role === 'admin' || req.user.role === 'faculty') return { ok: true, event };
  if (req.user.role === 'teamleader') {
    if (req.user.teamId && event.teamId && req.user.teamId.toString() === event.teamId.toString()) {
      return { ok: true, event };
    }
    return { ok: false, status: 403, message: 'Access denied' };
  }
  return { ok: false, status: 403, message: 'Access denied' };
};

// POST /api/events/:id/register
// Member/CA can register themselves; capacity auto-closes when full
router.post('/:id/register', requireRole('member', 'volunteer', 'campus_ambassador', 'teamleader', 'faculty', 'admin'), async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event || !event.isActive) return res.status(404).json({ success: false, message: 'Event not found' });

    const capacity = event.maxParticipants ?? event.capacity ?? null;
    if (capacity !== null && event.currentParticipants >= capacity) {
      return res.status(400).json({ success: false, message: 'Registration closed: event is full' });
    }

    // --- Referral code resolution ---
    const referralCode = req.body?.referralCode?.trim().toUpperCase() || null;
    let caUser = null;
    if (referralCode) {
      caUser = await User.findOne({
        referralCode,
        role: 'campus_ambassador',
        isActive: true,
      }).select('_id name referralCode');
      // If referral code is invalid, we proceed silently (no points, no error)
    }

    // Create registration
    const reg = await EventRegistration.create({
      eventId: event._id,
      userId: req.user.id,
      status: 'registered',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || null,
      referralCode: caUser ? referralCode : null,
      caId: caUser ? caUser._id : null,
    });

    // --- Award CA points (idempotent via unique partial index) ---
    if (caUser) {
      try {
        const pts = event.isFlagship
          ? POINTS_CONFIG.EVENT_REFERRAL.flagship
          : POINTS_CONFIG.EVENT_REFERRAL.regular;

        await PointsLedger.create({
          userId: caUser._id,
          eventId: event._id,
          points: pts,
          type: 'earned',
          source: 'event_referral',
          referralCode,
          reason: `Event registration: ${event.name}${event.isFlagship ? ' (Flagship)' : ''}`,
          createdBy: req.user.id,
        });
      } catch (pointsErr) {
        // Duplicate key (11000) means points were already awarded — ignore silently
        if (pointsErr?.code !== 11000) {
          console.error('[CA Points] Failed to award points:', pointsErr.message);
        }
      }
    }

    res.status(201).json({ success: true, registration: reg });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Already registered' });
    }
    next(err);
  }
});

// GET /api/events/:id/participants
// Admin/Faculty/TL (same team) can list participants
router.get('/:id/participants', requireRole('admin', 'faculty', 'teamleader'), async (req, res, next) => {
  try {
    const authz = await canManageEvent(req, req.params.id);
    if (!authz.ok) return res.status(authz.status).json({ success: false, message: authz.message });

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const filter = { eventId: req.params.id };
    if (req.query.status) filter.status = req.query.status;

    // Optional search by participant name/email
    let userMatch = null;
    if (req.query.search) {
      userMatch = {
        $or: [
          { 'user.name': { $regex: req.query.search, $options: 'i' } },
          { 'user.email': { $regex: req.query.search, $options: 'i' } },
        ],
      };
    }

    const pipeline = [
      { $match: filter },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
    ];
    if (userMatch) pipeline.push({ $match: userMatch });
    pipeline.push(
      { $sort: { registeredAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          status: 1,
          registeredAt: 1,
          confirmedAt: 1,
          attendedAt: 1,
          notes: 1,
          user: {
            _id: '$user._id',
            name: '$user.name',
            email: '$user.email',
            role: '$user.role',
            teamId: '$user.teamId',
          },
        },
      }
    );

    const [participants, total, event] = await Promise.all([
      EventRegistration.aggregate(pipeline),
      EventRegistration.countDocuments(filter),
      Event.findById(req.params.id).select('maxParticipants capacity currentParticipants'),
    ]);

    const capacity = event?.maxParticipants ?? event?.capacity ?? null;
    const progress = capacity ? Math.min(100, Math.round(((event.currentParticipants || 0) / capacity) * 100)) : null;

    res.json({
      success: true,
      participants,
      total,
      page,
      pages: Math.ceil(total / limit),
      capacity,
      currentParticipants: event?.currentParticipants || 0,
      progress,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/events/:id/participants/:userId/attendance
// Toggle attendance -> attended / no_show
router.patch('/:id/participants/:userId/attendance', requireRole('admin', 'faculty', 'teamleader'), async (req, res, next) => {
  try {
    const authz = await canManageEvent(req, req.params.id);
    if (!authz.ok) return res.status(authz.status).json({ success: false, message: authz.message });

    const reg = await EventRegistration.findOne({ eventId: req.params.id, userId: req.params.userId });
    if (!reg) return res.status(404).json({ success: false, message: 'Participant not found' });

    const markAttended = req.body && typeof req.body.attended === 'boolean' ? req.body.attended : null;
    const nextAttended = markAttended === null ? reg.status !== 'attended' : markAttended;

    if (nextAttended) {
      reg.status = 'attended';
      reg.attendedAt = new Date();
    } else {
      reg.status = 'no_show';
      reg.attendedAt = null;
    }

    await reg.save();
    res.json({ success: true, registration: reg });
  } catch (err) {
    next(err);
  }
});

// GET /api/events/:id/participants/export
// CSV export
router.get('/:id/participants/export', requireRole('admin', 'faculty', 'teamleader'), async (req, res, next) => {
  try {
    const authz = await canManageEvent(req, req.params.id);
    if (!authz.ok) return res.status(authz.status).json({ success: false, message: authz.message });

    const event = await Event.findById(req.params.id).select('name');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const regs = await EventRegistration.find({ eventId: req.params.id })
      .populate('userId', 'name email role phone')
      .sort({ registeredAt: -1 });

    const escapeCsv = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      const needsQuotes = /[",\n\r]/.test(s);
      const escaped = s.replace(/"/g, '""');
      return needsQuotes ? `"${escaped}"` : escaped;
    };

    const header = ['Name', 'Email', 'Role', 'Phone', 'Status', 'RegisteredAt', 'AttendedAt'];
    const lines = [header.join(',')];

    regs.forEach((r) => {
      const u = r.userId;
      lines.push([
        escapeCsv(u?.name),
        escapeCsv(u?.email),
        escapeCsv(u?.role),
        escapeCsv(u?.phone),
        escapeCsv(r.status),
        escapeCsv(r.registeredAt ? new Date(r.registeredAt).toISOString() : ''),
        escapeCsv(r.attendedAt ? new Date(r.attendedAt).toISOString() : ''),
      ].join(','));
    });

    const fileName = `participants_${event.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(lines.join('\n'));
  } catch (err) {
    next(err);
  }
});

// POST /api/events/upload — Admin only
router.post('/upload', requireRole('admin'), blockFacultyWrite, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

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

    res.json({ success: true, url: fileUrl, title: req.body.title || req.file.originalname });
  } catch (err) {
    next(err);
  }
});

// POST /api/events — Admin only
router.post('/', requireRole('admin'), blockFacultyWrite, validate(eventSchema), async (req, res, next) => {
  try {
    const payload = { ...req.body };
    if (payload.maxParticipants === undefined && payload.capacity !== undefined) {
      payload.maxParticipants = payload.capacity;
    }
    const event = await Event.create({ ...payload, createdBy: req.user.id });
    await event.populate(['teamId', 'createdBy']);
    res.status(201).json({ success: true, event });
  } catch (err) {
    next(err);
  }
});

// PUT /api/events/:id — Admin only
router.put('/:id', requireRole('admin'), blockFacultyWrite, async (req, res, next) => {
  try {
    const payload = { ...req.body };
    if (payload.maxParticipants === undefined && payload.capacity !== undefined) {
      payload.maxParticipants = payload.capacity;
    }
    const event = await Event.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true })
      .populate('teamId', 'name')
      .populate('createdBy', 'name');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    res.json({ success: true, event });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/events/:id — Admin only
router.delete('/:id', requireRole('admin'), blockFacultyWrite, async (req, res, next) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Event deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;