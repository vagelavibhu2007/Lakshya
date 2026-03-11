const express = require('express');
const Team = require('../models/Team');
const { User } = require('../models/User');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
router.use(verifyToken);

// GET /api/contacts — all team leads with their team info
router.get('/', async (req, res, next) => {
  try {
    const teams = await Team.find().sort({ name: 1 });
    const leads = await User.find({ role: 'teamleader', isActive: true }).select('name email avatarUrl teamId phone');

    const contacts = teams
      .map((t) => {
        const teamLeads = leads.filter((l) => l.teamId && l.teamId.toString() === t._id.toString());
        if (teamLeads.length === 0) return null;
        
        return {
          teamId: t._id,
          teamName: t.name,
          teamColor: t.color,
          teamDescription: t.description,
          leaders: teamLeads.map((l) => ({
            _id: l._id,
            name: l.name,
            email: l.email,
            avatarUrl: l.avatarUrl,
            phone: l.phone || null,
          })),
        };
      })
      .filter(Boolean);

    res.json({ success: true, contacts });
  } catch (err) {
    next(err);
  }
});

module.exports = router;