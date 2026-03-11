const mongoose = require('mongoose');
const Team = require('../models/Team');

/**
 * requireTeamScope — for Team Leader routes.
 * Ensures a TL can only operate on their own team.
 * Checks req.body.teamId OR req.params.teamId OR req.query.teamId against req.user.teamId
 */
const requireTeamScope = async (req, res, next) => {
  if (req.user.role === 'admin') return next();

  const targetTeamId =
    req.params.teamId ||
    req.body.teamId ||
    req.query.teamId;

  if (!targetTeamId) return next(); // no teamId to check

  if (req.user.role === 'teamleader') {
    const userTeamId = req.user.teamId ? req.user.teamId.toString() : null;
    if (!userTeamId || userTeamId !== targetTeamId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only manage your own team',
      });
    }
  }
  next();
};

/**
 * injectTeamFilter — adds teamId filter for non-admin users automatically.
 * Applied before controllers on list routes.
 */
const injectTeamFilter = (req, res, next) => {
  const { role, teamId } = req.user;
  if (role === 'teamleader' && teamId) {
    req.teamFilter = { teamId };
  } else if (role === 'volunteer' || role === 'campus_ambassador') {
    req.teamFilter = teamId ? { teamId } : {};
  } else {
    req.teamFilter = {}; // admin / faculty see all
  }
  next();
};

module.exports = { requireTeamScope, injectTeamFilter };