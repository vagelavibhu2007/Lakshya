/**
 * RBAC middleware factory.
 * Usage: requireRole('admin', 'teamleader')
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${roles.join(', ')}`,
      });
    }
    next();
  };
};

/**
 * Faculty read-only block.
 * Blocks any non-GET method for faculty users.
 */
const blockFacultyWrite = (req, res, next) => {
  if (req.user && req.user.role === 'faculty' && req.method !== 'GET') {
    return res.status(403).json({
      success: false,
      message: 'Faculty users have read-only access',
    });
  }
  next();
};

/**
 * Volunteer/CA can only access their own resources.
 * Applied on routes where :userId param is used.
 */
const requireSelfOrAdmin = (req, res, next) => {
  const { id, role } = req.user;
  const targetId = req.params.userId || req.params.id;
  if (role === 'admin' || id === targetId) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'You can only access your own data',
  });
};

module.exports = { requireRole, blockFacultyWrite, requireSelfOrAdmin };