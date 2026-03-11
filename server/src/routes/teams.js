const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const Team = require('../models/Team');
const { User } = require('../models/EnhancedUser');
const Task = require('../models/Task');
const { validate, teamSchema } = require('../validators/schemas');

router.use(verifyToken);

// GET /api/teams
router.get('/', async (req, res, next) => {
  try {
    const teams = await Team.find().populate('teamLeads', 'name email').sort({ name: 1 });
    // Also find all users with role=teamleader, merge with teamLeads
    const allTLs = await User.find({ role: 'teamleader', isActive: true }).select('name email teamId');
    
    const teamsWithLeads = teams.map(t => {
      const teamObj = t.toObject();
      // Get existing teamLeads IDs
      const existingIds = new Set((teamObj.teamLeads || []).map(l => l._id.toString()));
      // Find TLs assigned to this team by teamId but not in teamLeads array
      const extraTLs = allTLs.filter(u => u.teamId && u.teamId.toString() === t._id.toString() && !existingIds.has(u._id.toString()));
      // Merge
      teamObj.teamLeads = [...(teamObj.teamLeads || []), ...extraTLs.map(u => ({ _id: u._id, name: u.name, email: u.email }))];
      return teamObj;
    });
    
    res.json({ success: true, teams: teamsWithLeads });
  } catch (err) {
    next(err);
  }
});

// GET /api/teams/:id
router.get('/:id', async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id).populate('teamLeads', 'name email');
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });
    const members = await User.find({ teamId: req.params.id, isActive: true }).select('name email role avatarUrl').sort({ name: 1 });
    res.json({ success: true, team, members });
  } catch (err) {
    next(err);
  }
});

// POST /api/teams — Admin only
router.post('/', requireRole('admin'), validate(teamSchema), async (req, res, next) => {
  try {
    const team = await Team.create(req.body);
    res.status(201).json({ success: true, team });
  } catch (err) {
    next(err);
  }
});

// PUT /api/teams/:id — Admin only
router.put('/:id', requireRole('admin'), validate(teamSchema), async (req, res, next) => {
  try {
    const { name, description, teamLeads, color } = req.body;
    const team = await Team.findByIdAndUpdate(
      req.params.id,
      { name, description, teamLeads: teamLeads || [], color },
      { new: true, runValidators: true }
    ).populate('teamLeads', 'name email');
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });

    // If assigning leaders, update their roles to teamleader
    if (teamLeads && teamLeads.length > 0) {
      await User.updateMany({ _id: { $in: teamLeads } }, { role: 'teamleader', teamId: team._id });
    }
    res.json({ success: true, team });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/teams/:id — Admin only
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    await Team.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Team deleted' });
  } catch (err) {
    next(err);
  }
});

// GET /api/teams/:id/cas
// Get all Campus Ambassadors in a team with their referral codes (Team Lead only)
router.get('/:id/cas', requireRole('teamleader', 'admin'), async (req, res, next) => {
  try {
    const teamId = req.params.id;
    
    // Check if user is team lead of this team or admin
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });
    
    const isTeamLead = team.teamLeads.some(lead => lead.toString() === req.user.id);
    const isAdmin = req.user.role === 'admin';
    
    if (!isTeamLead && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    // For Marketing team, get CAs with referral codes
    if (team.name === 'Marketing') {
      const cas = await User.find({ 
        teamId: teamId, 
        role: 'campus_ambassador', 
        isActive: true 
      }).select('name email referralCode referralCount createdAt');
      
      res.json({ 
        success: true, 
        teamName: team.name,
        cas: cas.map(ca => ({
          _id: ca._id,
          name: ca.name,
          email: ca.email,
          referralCode: ca.referralCode || 'Not Generated',
          referralCount: ca.referralCount || 0,
          createdAt: ca.createdAt
        }))
      });
    } else {
      // For non-marketing teams, just return basic CA info
      const cas = await User.find({ 
        teamId: teamId, 
        role: 'campus_ambassador', 
        isActive: true 
      }).select('name email createdAt');
      
      res.json({ 
        success: true, 
        teamName: team.name,
        cas: cas.map(ca => ({
          _id: ca._id,
          name: ca.name,
          email: ca.email,
          referralCode: 'N/A (Marketing CAs only)',
          referralCount: 0,
          createdAt: ca.createdAt
        }))
      });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;