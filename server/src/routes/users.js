const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const xlsx = require('xlsx');
const { User } = require('../models/EnhancedUser');
const Team = require('../models/Team');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { validate, createUserSchema, updateUserSchema } = require('../validators/schemas');

const router = express.Router();

// Helper: ensure CA is assigned to allowed teams (Marketing or Online Marketing)
const assertCAValidTeam = async (role, teamId) => {
  if (role !== 'campus_ambassador') return null; // no constraint
  if (!teamId) return 'Campus Ambassadors must be assigned to an allowed team.';
  const team = await Team.findById(teamId).select('name');
  if (!team) return 'Team not found.';
  const allowedTeams = ['marketing', 'online marketing'];
  if (!allowedTeams.includes(team.name.toLowerCase())) {
    return `Campus Ambassadors can only be in the Marketing or Online Marketing team, not "${team.name}".`;
  }
  return null; // OK
};

// All user routes require auth
router.use(verifyToken);

// GET /api/users — Admin sees all, others see their team
router.get('/', async (req, res, next) => {
  try {
    const { role, teamId } = req.user;
    let filter = {};
    if (role === 'teamleader') filter.$or = [{ teamId }, { secondaryTeamIds: teamId }];
    else if (role === 'member' || role === 'campus_ambassador') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
      ];
    }
    if (req.query.role) filter.role = req.query.role;
    if (req.query.teamId && role === 'admin') filter.$or = [{ teamId: req.query.teamId }, { secondaryTeamIds: req.query.teamId }];

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-passwordHash -refreshTokenHash')
        .populate('teamId', 'name color')
        .populate('secondaryTeamIds', 'name color')
        .populate('managedTeams', 'name color')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);
    res.json({ success: true, users, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

// POST /api/users/bulk-status (admin only) — must be before /:id
router.post('/bulk-status', requireRole('admin'), async (req, res, next) => {
  try {
    const { userIds, isActive } = req.body;
    if (!Array.isArray(userIds) || typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }
    await User.updateMany({ _id: { $in: userIds } }, { isActive });
    res.json({ success: true, message: `Users ${isActive ? 'activated' : 'deactivated'} successfully` });
  } catch(err) {
    next(err);
  }
});

// GET /api/users/team/:teamId — must be before /:id
router.get('/team/:teamId', requireRole('teamleader', 'admin'), async (req, res, next) => {
  try {
    if (req.user.role === 'teamleader' && req.user.teamId?.toString() !== req.params.teamId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const users = await User.find({ $or: [{ teamId: req.params.teamId }, { secondaryTeamIds: req.params.teamId }] })
      .select('-passwordHash -refreshTokenHash')
      .populate('teamId', 'name color')
      .populate('secondaryTeamIds', 'name color')
      .sort({ createdAt: -1 });
    res.json({ success: true, users, total: users.length });
  } catch (err) {
    next(err);
  }
});

// POST /api/users/team/:teamId — must be before /:id
router.post('/team/:teamId', requireRole('teamleader', 'admin'), validate(createUserSchema), async (req, res, next) => {
  try {
    if (req.user.role === 'teamleader' && req.user.teamId?.toString() !== req.params.teamId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const { name, email, password, role, phone } = req.body;
    
    // check unique
    const existing = await User.findOne({ email });
    if (existing) {
      if (req.params.teamId && existing.teamId && existing.teamId.toString() !== req.params.teamId.toString()) {
        // ONLY ADMIN can add existing user to a second team
        if (req.user.role !== 'admin') {
          return res.status(400).json({ success: false, message: 'Email already exists' });
        }
        if (!existing.secondaryTeamIds) existing.secondaryTeamIds = [];
        const isSecondary = existing.secondaryTeamIds.some(id => id.toString() === req.params.teamId.toString());
        if (!isSecondary) {
          existing.secondaryTeamIds.push(req.params.teamId);
          await existing.save();
          return res.status(200).json({ 
            success: true, 
            message: 'User already exists, added to secondary team',
            user: existing.toSafeObject() 
          });
        }
        return res.status(400).json({ success: false, message: 'Email already exists in this team' });
      }
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }
    
    if (req.user.role === 'teamleader' && !['member', 'campus_ambassador'].includes(role)) {
       return res.status(403).json({ success: false, message: 'Cannot create other roles' });
    }
    // CA validation
    const caErr = await assertCAValidTeam(role, req.params.teamId);
    if (caErr) return res.status(400).json({ success: false, message: caErr });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash, role, teamId: req.params.teamId, phone });
    res.status(201).json({ success: true, user: user.toSafeObject() });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'Email already exists' });
    next(err);
  }
});

// PATCH /api/users/team/:teamId/:userId — must be before /:id
router.patch('/team/:teamId/:userId', requireRole('teamleader', 'admin'), async (req, res, next) => {
  try {
    if (req.user.role === 'teamleader' && req.user.teamId?.toString() !== req.params.teamId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const targetUser = await User.findById(req.params.userId);
    if (!targetUser || targetUser.teamId?.toString() !== req.params.teamId) {
      return res.status(404).json({ success: false, message: 'User not found in this team' });
    }
    
    if (req.user.role === 'teamleader' && !['member', 'campus_ambassador'].includes(targetUser.role)) {
        return res.status(403).json({ success: false, message: 'Team leaders can only manage members' });
    }

    const { name, email, role, isActive, phone } = req.body;
    
    // Check if TL is trying to set a disallowed role
    if (req.user.role === 'teamleader' && role && !['member', 'campus_ambassador', 'teamleader'].includes(role)) {
        return res.status(403).json({ success: false, message: 'Invalid role assignment' });
    }

    const update = {};
    if (name !== undefined) update.name = name;
    if (role !== undefined) update.role = role;
    if (isActive !== undefined) update.isActive = isActive;
    if (phone !== undefined) update.phone = phone;
    
    if (email && email !== targetUser.email) {
       const existing = await User.findOne({ email });
       if (existing) return res.status(400).json({ success: false, message: 'Email already exists' });
       update.email = email;
    }

    const user = await User.findByIdAndUpdate(req.params.userId, update, { new: true, runValidators: true }).select('-passwordHash -refreshTokenHash').populate('teamId', 'name');
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/users/team/:teamId/:userId — TL or admin
// ?hard=true → permanently delete; default → soft deactivate
router.delete('/team/:teamId/:userId', requireRole('teamleader', 'admin'), async (req, res, next) => {
  try {
    if (req.user.role === 'teamleader' && req.user.teamId?.toString() !== req.params.teamId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const targetUser = await User.findById(req.params.userId);
    if (!targetUser || targetUser.teamId?.toString() !== req.params.teamId) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (req.user.role === 'teamleader' && !['member', 'campus_ambassador'].includes(targetUser.role)) {
        return res.status(403).json({ success: false, message: 'Team leaders can only manage members' });
    }
    if (req.query.hard === 'true') {
      await User.findByIdAndDelete(req.params.userId);
      res.json({ success: true, message: 'User permanently deleted' });
    } else {
      targetUser.isActive = false;
      await targetUser.save();
      res.json({ success: true, message: 'User deactivated' });
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/users/team/:teamId/import-members — TL or admin: bulk import for a specific team
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const generatePassword = (name) => {
  // Default: NameWithoutSpaces@1234  e.g. "John Doe" → "JohnDoe@1234"
  return name ? name.replace(/\s+/g, '') + '@1234' : 'Default@1234';
};

router.post('/team/:teamId/import-members', requireRole('teamleader', 'admin'), upload.single('file'), async (req, res, next) => {
  try {
    const { teamId } = req.params;

    // TL can only import into their own team
    if (req.user.role === 'teamleader' && req.user.teamId?.toString() !== teamId) {
      return res.status(403).json({ success: false, message: 'Access denied: You can only import into your own team.' });
    }

    const team = await Team.findById(teamId).select('name');
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return res.status(400).json({ success: false, message: 'No sheets found in file' });

    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'File contains no rows' });
    }
    if (rows.length > 2000) {
      return res.status(400).json({ success: false, message: 'Too many rows. Max allowed is 2000.' });
    }

    const failures = [];
    const prepared = [];
    const seenEmails = new Set();
    const allowedRoles = ['member', 'campus_ambassador'];
    const roleMap = {
      member: 'member', volunteer: 'member',
      ca: 'campus_ambassador', campus_ambassador: 'campus_ambassador', 'campus ambassador': 'campus_ambassador',
    };

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const obj = {};
      Object.keys(raw || {}).forEach(k => { obj[String(k).trim().toLowerCase()] = raw[k]; });

      const name = String(obj['full name'] || obj.fullname || obj.name || '').trim();
      const email = String(obj.email || obj['email id'] || obj.emailid || '').trim().toLowerCase();
      const phone = String(obj.phone || obj['phone number'] || obj.mobile || '').trim();
      const roleRaw = String(obj.role || '').trim();
      const password = String(obj.password || '').trim();
      const rowNumber = i + 2;

      if (!name) { failures.push({ row: rowNumber, email: email || null, reason: 'Missing Full Name' }); continue; }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { failures.push({ row: rowNumber, email: email || null, reason: 'Missing/invalid Email' }); continue; }

      const roleNorm = roleRaw.toLowerCase();
      const role = roleMap[roleNorm] || (roleRaw ? null : 'member');
      if (roleRaw && role === null) {
        failures.push({ row: rowNumber, email, reason: `Invalid role: "${roleRaw}". Use Member, CA, or leave blank.` });
        continue;
      }
      if (!allowedRoles.includes(role)) {
        failures.push({ row: rowNumber, email, reason: `Role "${role}" is not allowed. TL can only add Member or Campus Ambassador.` });
        continue;
      }

      // CA must be in allowed teams
      if (role === 'campus_ambassador' && !['marketing', 'online marketing'].includes(team.name.toLowerCase())) {
        failures.push({ row: rowNumber, email, reason: `Campus Ambassadors can only be in the Marketing or Online Marketing team. This import is for team "${team.name}" — please remove CA rows or switch to an allowed team.` });
        continue;
      }

      if (seenEmails.has(email)) { failures.push({ row: rowNumber, email, reason: 'Duplicate email within file' }); continue; }
      seenEmails.add(email);

      prepared.push({ row: rowNumber, name, email, phone: phone || null, role, password: password || null });
    }

    if (prepared.length === 0) {
      return res.json({ success: true, totalRecords: rows.length, successfullyAdded: 0, failedCount: failures.length, failedEntries: failures, message: 'No valid rows to import' });
    }

    const existingEmails = await User.find({ email: { $in: prepared.map(r => r.email) } }).select('email');
    const existingSet = new Set(existingEmails.map(u => u.email.toLowerCase()));

    const toInsert = [];
    for (const r of prepared) {
      if (existingSet.has(r.email)) { failures.push({ row: r.row, email: r.email, reason: 'Email already exists (skipped)' }); continue; }
      toInsert.push(r);
    }

    if (toInsert.length === 0) {
      return res.json({ success: true, totalRecords: rows.length, successfullyAdded: 0, failedCount: failures.length, failedEntries: failures, message: 'All rows were skipped/invalid' });
    }

    let successfullyAdded = 0;
    try {
      const insertDocs = await Promise.all(toInsert.map(async r => ({
        name: r.name, email: r.email, phone: r.phone, teamId,
        role: r.role, isActive: true,
        passwordHash: await bcrypt.hash(r.password || generatePassword(r.name), 12),
      })));
      const created = await User.insertMany(insertDocs, { ordered: false });
      successfullyAdded = Array.isArray(created) ? created.length : 0;

      // Generate referral codes for CA imports in Marketing team
      const caUsers = (Array.isArray(created) ? created : []).filter(u => u.role === 'campus_ambassador');
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      for (const caUser of caUsers) {
        if (!caUser.referralCode) {
          const teamNameLower = team.name.toLowerCase();
          if (['marketing', 'online marketing'].includes(teamNameLower)) {
            let code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
            const exists = await User.findOne({ referralCode: code }).select('_id');
            if (!exists) await User.findByIdAndUpdate(caUser._id, { referralCode: code });
          }
        }
      }
    } catch (err) {
      successfullyAdded = Array.isArray(err.insertedDocs) ? err.insertedDocs.length : 0;
      (Array.isArray(err.writeErrors) ? err.writeErrors : []).forEach(we => {
        const meta = toInsert[we.index];
        failures.push({ row: meta?.row || null, email: meta?.email || null, reason: we.errmsg?.includes('E11000') ? 'Email already exists' : (we.message || 'Insert failed') });
      });
    }

    return res.json({ success: true, totalRecords: rows.length, successfullyAdded, failedCount: failures.length, failedEntries: failures });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id — after all specific routes
router.get('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash -refreshTokenHash').populate('teamId', 'name color');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

// POST /api/users — Admin only
router.post('/', requireRole('admin'), validate(createUserSchema), async (req, res, next) => {
  try {
    const { name, email, password, role, teamId, phone } = req.body;
    const existing = await User.findOne({ email });
    if (existing) {
      if (teamId && existing.teamId && existing.teamId.toString() !== teamId.toString()) {
        if (!existing.secondaryTeamIds) existing.secondaryTeamIds = [];
        const isSecondary = existing.secondaryTeamIds.some(id => id.toString() === teamId.toString());
        if (!isSecondary) {
          existing.secondaryTeamIds.push(teamId);
          await existing.save();
          return res.status(200).json({ 
            success: true, 
            message: 'User already exists, added to secondary team',
            user: existing.toSafeObject() 
          });
        }
        return res.status(400).json({ success: false, message: 'User already exists in this team' });
      }
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }
    // CA validation
    const caErr = await assertCAValidTeam(role, teamId);
    if (caErr) return res.status(400).json({ success: false, message: caErr });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name, email, passwordHash, role,
      teamId: teamId || null,
      phone,
    });
    res.status(201).json({ success: true, user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/:id — Admin only
router.put('/:id', requireRole('admin'), validate(updateUserSchema), async (req, res, next) => {
  try {
    const update = {};
    const { name, role, teamId, secondaryTeamIds, isActive, email, phone } = req.body;
    if (name !== undefined) update.name = name;
    if (role !== undefined) update.role = role;
    if (teamId !== undefined) update.teamId = teamId || null;
    if (secondaryTeamIds !== undefined) update.secondaryTeamIds = secondaryTeamIds || [];
    if (isActive !== undefined) update.isActive = isActive;
    if (phone !== undefined) update.phone = phone;
    if (email) {
      const existing = await User.findOne({ email, _id: { $ne: req.params.id } });
      if (existing) return res.status(400).json({ success: false, message: 'Email already exists' });
      update.email = email;
    }

    // CA must be Marketing team (check effective role and teamId)
    const effectiveRole = role !== undefined ? role : (await User.findById(req.params.id).select('role'))?.role;
    const effectiveTeamId = teamId !== undefined ? (teamId || null) : (await User.findById(req.params.id).select('teamId'))?.teamId;
    const caErr = await assertCAValidTeam(effectiveRole, effectiveTeamId);
    if (caErr) return res.status(400).json({ success: false, message: caErr });

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).select('-passwordHash -refreshTokenHash').populate('teamId', 'name');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/users/:id — Admin only
// ?hard=true → permanently delete from DB
// (default) → soft deactivate
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
    }
    if (req.query.hard === 'true') {
      await User.findByIdAndDelete(req.params.id);
      res.json({ success: true, message: 'User permanently deleted' });
    } else {
      await User.findByIdAndUpdate(req.params.id, { isActive: false });
      res.json({ success: true, message: 'User deactivated' });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;