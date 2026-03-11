const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const xlsx = require('xlsx');

const { User } = require('../models/EnhancedUser');
const Team = require('../models/Team');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { sendBulkUserCredentialsEmail } = require('../utils/emailService');

const router = express.Router();

router.use(verifyToken);
router.use(requireRole('admin'));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const name = String(file.originalname || '').toLowerCase();
    const okExt = name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv');
    if (!okExt) return cb(new Error('Only .xlsx, .xls, or .csv files are allowed'));
    return cb(null, true);
  },
});

const defaultPasswordForName = (name) => {
  // Remove all spaces, keep original casing, append @1234
  return name.replace(/\s+/g, '') + '@1234';
};

const normalizeRow = (row) => {
  const obj = {};
  Object.keys(row || {}).forEach((k) => {
    const key = String(k || '').trim().toLowerCase();
    obj[key] = row[k];
  });

  const name = String(obj.name || obj.fullname || obj['full name'] || '').trim();
  const email = String(obj.email || obj['email id'] || obj['emailid'] || '').trim().toLowerCase();
  const roleRaw = String(obj.role || '').trim().toLowerCase();
  const teamName = String(obj.team || obj.teamname || obj['team name'] || '').trim();
  const phone = obj.phone ? String(obj.phone).trim() : '';

  // Map common role values
  const roleMap = {
    volunteer: 'member',
    member: 'member',
    ca: 'campus_ambassador',
    campus_ambassador: 'campus_ambassador',
    'campus ambassador': 'campus_ambassador',
    teamleader: 'teamleader',
    'team leader': 'teamleader',
    faculty: 'faculty',
    admin: 'admin',
  };

  const role = roleMap[roleRaw] || roleRaw;

  return { name, email, role, teamName, phone };
};

const normalizeMemberRow = (row) => {
  const obj = {};
  Object.keys(row || {}).forEach((k) => {
    const key = String(k || '').trim().toLowerCase();
    obj[key] = row[k];
  });

  const name = String(obj['full name'] || obj.fullname || obj.name || '').trim();
  const email = String(obj.email || obj['email id'] || obj.emailid || '').trim().toLowerCase();
  const phone = String(obj.phone || obj['phone number'] || obj.mobilenumber || obj.mobile || '').trim();
  const teamName = String(obj['team name'] || obj.teamname || obj.team || '').trim();
  const roleRaw = String(obj.role || '').trim();
  const password = String(obj.password || obj['password'] || '').trim();

  // Map role to internal value; absent role defaults to 'member'
  const roleNorm = roleRaw.toLowerCase();
  const roleMap = {
    member: 'member',
    volunteer: 'member',
    ca: 'campus_ambassador',
    campus_ambassador: 'campus_ambassador',
    'campus ambassador': 'campus_ambassador',
    admin: 'admin',
    teamleader: 'teamleader',
    'team leader': 'teamleader',
    faculty: 'faculty',
  };
  const role = roleMap[roleNorm] || (roleRaw ? null : 'member'); // null signals an invalid role

  return { name, email, phone, teamName, roleRaw, role, password };
};

const isValidEmail = (email) => {
  if (!email) return false;
  // Simple, safe email check (avoid overly strict RFC regex)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const ensureTeamsByName = async (teamNames) => {
  const map = new Map(); // lowerName -> _id
  const allTeams = await Team.find().select('name');
  for (const t of allTeams) {
    map.set(String(t.name).trim().toLowerCase(), t._id);
  }

  const uniqueNames = Array.from(
    new Set(
      (teamNames || [])
        .map((n) => String(n || '').trim())
        .filter(Boolean)
        .map((n) => n)
    )
  );

  for (const teamName of uniqueNames) {
    const key = teamName.toLowerCase();
    if (map.has(key)) continue;
    const team = await Team.findOneAndUpdate(
      { name: teamName },
      { $setOnInsert: { name: teamName } },
      { upsert: true, new: true }
    ).select('_id name');
    map.set(String(team.name).trim().toLowerCase(), team._id);
  }

  return map;
};

// POST /api/admin/users/import
// multipart/form-data: file
// query/body:
// - sendEmail: true/false
router.post('/import', upload.single('file'), async (req, res, next) => {
  try {
    const sendEmail = String(req.body.sendEmail || 'false') === 'true';

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // xlsx can read csv/xlsx from buffer
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return res.status(400).json({ success: false, message: 'No sheets found in file' });
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'File contains no rows' });
    }

    // Build team lookup
    const teams = await Team.find().select('name');
    const teamByName = new Map(teams.map((t) => [t.name.toLowerCase(), t._id]));

    const results = {
      created: 0,
      skipped: 0,
      errors: 0,
      rows: [],
    };

    // Process sequentially for deterministic emails + rate limits
    for (let index = 0; index < rows.length; index++) {
      const raw = rows[index];
      const normalized = normalizeRow(raw);

      const rowResult = {
        row: index + 2, // header assumed at row 1
        email: normalized.email,
        status: 'created',
        message: '',
      };

      try {
        if (!normalized.name || !normalized.email || !normalized.role) {
          rowResult.status = 'error';
          rowResult.message = 'Missing required fields (name/email/role)';
          results.errors += 1;
          results.rows.push(rowResult);
          continue;
        }

        if (!['admin', 'teamleader', 'faculty', 'member', 'campus_ambassador'].includes(normalized.role)) {
          rowResult.status = 'error';
          rowResult.message = `Invalid role: ${normalized.role}`;
          results.errors += 1;
          results.rows.push(rowResult);
          continue;
        }

        const existing = await User.findOne({ email: normalized.email });
        if (existing) {
          // If admin is adding an existing user to a NEW team, update secondaryTeamIds
          let teamId = null;
          if (normalized.teamName) {
            teamId = teamByName.get(normalized.teamName.toLowerCase()) || null;
            if (!teamId) {
              rowResult.status = 'error';
              rowResult.message = `Unknown team: ${normalized.teamName}`;
              results.errors += 1;
              results.rows.push(rowResult);
              continue;
            }
          }

          if (teamId) {
            if (!existing.secondaryTeamIds) existing.secondaryTeamIds = [];
            const isMainTeam = existing.teamId && existing.teamId.toString() === teamId.toString();
            const isSecondary = existing.secondaryTeamIds.some(id => id.toString() === teamId.toString());

            if (!isMainTeam && !isSecondary) {
              existing.secondaryTeamIds.push(teamId);
              await existing.save();
              rowResult.status = 'updated';
              rowResult.message = 'Added to secondary team';
              results.created += 1; // Count as success
              results.rows.push(rowResult);
              continue;
            }
          }

          rowResult.status = 'skipped';
          rowResult.message = 'Email already exists in this team';
          results.skipped += 1;
          results.rows.push(rowResult);
          continue;
        }

        let teamId = null;
        if (normalized.teamName) {
          teamId = teamByName.get(normalized.teamName.toLowerCase()) || null;
          if (!teamId) {
            rowResult.status = 'error';
            rowResult.message = `Unknown team: ${normalized.teamName}`;
            results.errors += 1;
            results.rows.push(rowResult);
            continue;
          }
        }

        const tempPassword = generatePassword();
        const passwordHash = await bcrypt.hash(tempPassword, 12);

        const user = await User.create({
          name: normalized.name,
          email: normalized.email,
          passwordHash,
          role: normalized.role,
          teamId,
          phone: normalized.phone || null,
          isActive: true,
        });

        results.created += 1;
        rowResult.message = `Created user ${user._id}`;

        if (sendEmail) {
          await sendBulkUserCredentialsEmail(user.email, user.name, tempPassword, user.role);
          rowResult.message += ' (email sent)';
        }

        results.rows.push(rowResult);
      } catch (err) {
        rowResult.status = 'error';
        rowResult.message = err && err.message ? err.message : 'Unknown error';
        results.errors += 1;
        results.rows.push(rowResult);
      }
    }

    res.json({ success: true, ...results });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/users/import-members
// multipart/form-data: file
// Expected columns:
// - Full Name
// - Email
// - Phone
// - Team Name
// - Role (optional; must be "Member" if provided)
router.post('/import-members', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const MAX_ROWS = 2000; // safety cap
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return res.status(400).json({ success: false, message: 'No sheets found in file' });
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'File contains no rows' });
    }
    if (rows.length > MAX_ROWS) {
      return res.status(400).json({ success: false, message: `Too many rows. Max allowed is ${MAX_ROWS}.` });
    }

    const failures = [];
    const prepared = [];

    // Detect duplicates within the file (case-insensitive email)
    const seenEmails = new Set();

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const r = normalizeMemberRow(raw);
      const rowNumber = i + 2; // header assumed at row 1

      if (!r.name) {
        failures.push({ row: rowNumber, email: r.email || null, reason: 'Missing Full Name' });
        continue;
      }
      if (!r.email || !isValidEmail(r.email)) {
        failures.push({ row: rowNumber, email: r.email || null, reason: 'Missing/invalid Email' });
        continue;
      }
      if (!r.phone) {
        failures.push({ row: rowNumber, email: r.email, reason: 'Missing Phone' });
        continue;
      }
      if (!r.teamName) {
        failures.push({ row: rowNumber, email: r.email, reason: 'Missing Team Name' });
        continue;
      }

      if (r.roleRaw && r.role === null) {
        // roleRaw was provided but not a recognised value
        failures.push({ row: rowNumber, email: r.email, reason: `Role must be a valid system role ("Admin", "Team Leader", "Faculty", "Member", "CA" / "Campus Ambassador") or left blank — got: "${r.roleRaw}"` });
        continue;
      }

      if (seenEmails.has(r.email)) {
        failures.push({ row: rowNumber, email: r.email, reason: 'Duplicate Email within file (skipped)' });
        continue;
      }
      seenEmails.add(r.email);

      // CA must be in allowed teams
      const teamNameLower = String(r.teamName).trim().toLowerCase();
      if (r.role === 'campus_ambassador' && !['marketing', 'online marketing'].includes(teamNameLower)) {
        failures.push({ row: rowNumber, email: r.email, reason: `Campus Ambassadors can only be in the Marketing or Online Marketing team. Got: "${r.teamName}"` });
        continue;
      }

      prepared.push({
        row: rowNumber,
        name: r.name,
        email: r.email,
        phone: r.phone,
        teamName: r.teamName,
        role: r.role || 'member',
        password: r.password || null,
      });
    }

    if (prepared.length === 0) {
      return res.json({
        success: true,
        totalRecords: rows.length,
        successfullyAdded: 0,
        failedCount: failures.length,
        failedEntries: failures,
        message: 'No valid rows to import',
      });
    }

    // Ensure teams exist (create missing) - needed for existing user check and new inserts
    const teamNames = prepared.map((r) => r.teamName);
    const teamByLowerName = await ensureTeamsByName(teamNames);

    const toInsert = [];
    let successfullyAddedCount = 0; 

    for (const r of prepared) {
      const existingUser = await User.findOne({ email: r.email });
      if (existingUser) {
        // Find team
        const targetTeamId = teamByLowerName.get(String(r.teamName).trim().toLowerCase());
        if (targetTeamId) {
          if (!existingUser.secondaryTeamIds) existingUser.secondaryTeamIds = [];
          const isMainTeam = existingUser.teamId && existingUser.teamId.toString() === targetTeamId.toString();
          const isSecondary = existingUser.secondaryTeamIds.some(id => id.toString() === targetTeamId.toString());

          if (!isMainTeam && !isSecondary) {
            // ONLY ADMIN can add existing user to second team
            if (req.user.role !== 'admin') {
              failures.push({ row: r.row, email: r.email, reason: 'Email already exists in another team' });
              continue;
            }
            existingUser.secondaryTeamIds.push(targetTeamId);
            await existingUser.save();
            successfullyAddedCount += 1;
            continue; // Handled as update
          }
        }
        failures.push({ row: r.row, email: r.email, reason: 'Email already exists in this team (skipped)' });
        continue;
      }
      toInsert.push(r);
    }

    if (toInsert.length === 0 && successfullyAddedCount === 0) {
      return res.json({
        success: true,
        totalRecords: rows.length,
        successfullyAdded: successfullyAddedCount,
        failedCount: failures.length,
        failedEntries: failures,
        message: 'All rows were skipped/invalid (no new users created)',
      });
    }

    const defaultPassword = process.env.IMPORT_MEMBERS_DEFAULT_PASSWORD || process.env.DEFAULT_MEMBER_PASSWORD || null;
    const defaultPasswordHash = defaultPassword ? await bcrypt.hash(defaultPassword, 12) : null;

    const docs = [];
    for (const r of toInsert) {
      const teamId = teamByLowerName.get(String(r.teamName).trim().toLowerCase()) || null;
      if (!teamId) {
        failures.push({ row: r.row, email: r.email, reason: `Failed to create/find team: ${r.teamName}` });
        continue;
      }
      // Use per-row password if provided, else name-based default
      let rowPasswordHash;
      if (r.password) {
        rowPasswordHash = await bcrypt.hash(r.password, 12);
      } else {
        rowPasswordHash = defaultPasswordHash || (await bcrypt.hash(defaultPasswordForName(r.name), 12));
      }
      docs.push({
        row: r.row,
        role: r.role || 'member',
        document: {
          name: r.name,
          email: r.email,
          phone: r.phone,
          teamId,
          role: r.role || 'member',
          isActive: true,
          passwordHash: rowPasswordHash,
        },
      });
    }

    if (docs.length > 0) {
      const insertDocs = docs.map((d) => d.document);
      try {
        const created = await User.insertMany(insertDocs, { ordered: false });
        successfullyAddedCount += Array.isArray(created) ? created.length : 0;

        // Referral code generation
        const caUsers = Array.isArray(created)
          ? created.filter(u => u.role === 'campus_ambassador')
          : [];
        for (const caUser of caUsers) {
          try {
            const team = await Team.findById(caUser.teamId).select('name');
            const teamNameLower = team?.name?.toLowerCase();
            if (['marketing', 'online marketing'].includes(teamNameLower) && !caUser.referralCode) {
              const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
              let code = '';
              for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
              const existingCode = await User.findOne({ referralCode: code }).select('_id');
              if (!existingCode) {
                await User.findByIdAndUpdate(caUser._id, { referralCode: code });
              }
            }
          } catch (_) { /* skip */ }
        }
      } catch (err) {
        const insertedCount = Array.isArray(err.insertedDocs) ? err.insertedDocs.length : 0;
        successfullyAddedCount += insertedCount;

        const writeErrors = Array.isArray(err.writeErrors) ? err.writeErrors : [];
        for (const we of writeErrors) {
          const idx = we.index;
          const meta = docs[idx];
          const email = meta?.document?.email || null;
          const row = meta?.row || null;
          const msg = we.errmsg || we.message || 'Insert failed';
          const reason = msg.includes('E11000') ? 'Email already exists (race duplicate)' : msg;
          failures.push({ row, email, reason });
        }
      }
    }

    return res.json({
      success: true,
      totalRecords: rows.length,
      successfullyAdded: successfullyAddedCount,
      failedCount: failures.length,
      failedEntries: failures,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;