const express = require('express');
const { Announcement, AnnouncementRead } = require('../models/Announcement');
const { User } = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const { requireRole, blockFacultyWrite } = require('../middleware/rbac');
const { validate, announcementSchema } = require('../validators/schemas');
const { sendEmail, sendBatchEmails } = require('../utils/resendMailer');

const router = express.Router();
router.use(verifyToken);

// GET /api/announcements
router.get('/', async (req, res, next) => {
  try {
    const { role, teamId, id: userId } = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    let filter = {};
    // Admin/Faculty/TL see all; members/volunteers see scoped
    if (role === 'volunteer' || role === 'member' || role === 'campus_ambassador') {
      filter = {
        $and: [
          {
            $or: [
              { scope: 'global' },
              { scope: 'team', teamId },
              { scope: 'role', targetRoles: { $in: [role] } },
            ],
          },
          { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] },
        ],
      };
    } else if (role === 'teamleader') {
      filter = {
        $and: [
          { $or: [{ scope: 'global' }, { scope: 'team', teamId }, { scope: 'role', targetRoles: role }] },
          { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] },
        ],
      };
    } else {
      filter = { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] };
    }

    const [announcements, total] = await Promise.all([
      Announcement.find(filter)
        .populate('createdBy', 'name role')
        .populate('teamId', 'name')
        .sort({ pinned: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Announcement.countDocuments(filter),
    ]);

    // Attach read status
    const readRecords = await AnnouncementRead.find({
      userId,
      announcementId: { $in: announcements.map((a) => a._id) },
    });
    const readSet = new Set(readRecords.map((r) => r.announcementId.toString()));

    const result = announcements.map((a) => ({
      ...a.toObject(),
      isRead: readSet.has(a._id.toString()),
    }));

    res.json({ success: true, announcements: result, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

// GET /api/announcements/:id
router.get('/:id', async (req, res, next) => {
  try {
    const ann = await Announcement.findById(req.params.id)
      .populate('createdBy', 'name role')
      .populate('teamId', 'name');
    if (!ann) return res.status(404).json({ success: false, message: 'Announcement not found' });
    res.json({ success: true, announcement: ann });
  } catch (err) {
    next(err);
  }
});

// POST /api/announcements/:id/read — mark as read
router.post('/:id/read', async (req, res, next) => {
  try {
    await AnnouncementRead.findOneAndUpdate(
      { userId: req.user.id, announcementId: req.params.id },
      { readAt: new Date() },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * Helper: collect recipient emails based on announcement scope.
 */
async function getRecipientEmails(announcement) {
  let filter = { isActive: true };

  if (announcement.scope === 'global') {
    // All active users
  } else if (announcement.scope === 'team' && announcement.teamId) {
    filter.teamId = announcement.teamId;
  } else if (announcement.scope === 'role' && announcement.targetRoles?.length) {
    filter.role = { $in: announcement.targetRoles };
  }

  const users = await User.find(filter).select('email');
  return users.map((u) => u.email).filter(Boolean);
}

/**
 * Build announcement email HTML.
 */
function buildAnnouncementEmail(announcement, creatorName) {
  return `
    <div style="max-width:600px;margin:0 auto;background:#0f0f23;border-radius:12px;overflow:hidden;font-family:Arial,sans-serif;">
      <div style="background:linear-gradient(135deg,#6366f1,#ec4899);padding:25px 30px;">
        <h1 style="margin:0;color:white;font-size:20px;">📢 ${announcement.title}</h1>
        <p style="margin:5px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">
          By ${creatorName} · ${announcement.scope === 'global' ? '🌐 Global' : announcement.scope === 'team' ? '🏷️ Team' : '👤 Role-based'}
        </p>
      </div>
      <div style="padding:25px 30px;color:#e2e8f0;line-height:1.7;font-size:15px;">
        ${announcement.body.replace(/\n/g, '<br>')}
      </div>
      <div style="padding:15px 30px;background:#1a1a2e;text-align:center;">
        <p style="margin:0;color:#6b7280;font-size:12px;">TechFest Management System · Announcement</p>
      </div>
    </div>
  `;
}

// POST /api/announcements — Admin or TL
// Admin = global only (can still pick global/team/role)
// TL = team only (forced to their own team, scope = 'team')
router.post('/', requireRole('admin', 'teamleader'), blockFacultyWrite, validate(announcementSchema), async (req, res, next) => {
  try {
    const body = { ...req.body, createdBy: req.user.id };

    // Scope enforcement
    if (req.user.role === 'teamleader') {
      // TL can only create team-scoped announcements for their own team
      body.scope = 'team';
      body.teamId = req.user.teamId;
    }
    // Admin can select any scope (global, team, role)
    if (body.teamId === '') {
      body.teamId = null;
    }
    if (body.expiresAt === '') {
      body.expiresAt = null;
    }

    const ann = await Announcement.create(body);
    await ann.populate('createdBy', 'name');

    // If sendEmail is checked, fire off the email asynchronously
    if (ann.sendEmail) {
      (async () => {
        try {
          const emails = await getRecipientEmails(ann);
          if (emails.length > 0) {
            const html = buildAnnouncementEmail(ann, req.user.name || 'Admin');
            await sendBatchEmails(emails, `📢 ${ann.title}`, html);
          }
        } catch (emailErr) {
          console.error('Announcement email failed:', emailErr.message);
        }
      })();
    }

    res.status(201).json({ success: true, announcement: ann });
  } catch (err) {
    next(err);
  }
});

// PUT /api/announcements/:id
router.put('/:id', requireRole('admin', 'teamleader'), blockFacultyWrite, async (req, res, next) => {
  try {
    const ann = await Announcement.findById(req.params.id);
    if (!ann) return res.status(404).json({ success: false, message: 'Announcement not found' });
    if (req.user.role === 'teamleader' && ann.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only edit your own announcements' });
    }
    const allowed = ['title', 'body', 'scope', 'teamId', 'targetRoles', 'pinned', 'expiresAt', 'sendEmail'];
    const update = {};
    allowed.forEach((f) => { if (req.body[f] !== undefined) update[f] = req.body[f]; });
    
    if (update.teamId === '') {
      update.teamId = null;
    }
    if (update.expiresAt === '') {
      update.expiresAt = null;
    }

    const updated = await Announcement.findByIdAndUpdate(req.params.id, update, { new: true }).populate('createdBy', 'name').populate('teamId', 'name');
    res.json({ success: true, announcement: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/announcements/:id
router.delete('/:id', requireRole('admin', 'teamleader'), blockFacultyWrite, async (req, res, next) => {
  try {
    const ann = await Announcement.findById(req.params.id);
    if (!ann) return res.status(404).json({ success: false, message: 'Announcement not found' });
    
    if (req.user.role === 'teamleader' && ann.createdBy.toString() !== req.user.id) {
       return res.status(403).json({ success: false, message: 'You can only delete your own announcements' });
    }

    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;