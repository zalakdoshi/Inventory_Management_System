const ActivityLog = require('../models/ActivityLog');
const logger = require('../utils/logger');

/**
 * Create an activity log entry
 */
const createActivityLog = async ({
  user,
  action,
  module,
  description,
  details = null,
  req = null,
  severity = 'low',
}) => {
  try {
    const logData = {
      user: user?._id || user,
      userName: user?.name || 'System',
      userRole: user?.role || 'system',
      action,
      module,
      description,
      details,
      severity,
      ipAddress: req ? (req.ip || req.headers['x-forwarded-for'] || 'unknown') : 'system',
      userAgent: req ? req.headers['user-agent'] : 'system',
    };
    await ActivityLog.create(logData);
  } catch (error) {
    logger.error('Failed to create activity log:', error.message);
  }
};

/**
 * Express middleware to auto-log requests (optional usage)
 */
const activityLogger = (module) => (action) => async (req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode < 400 && req.user) {
      createActivityLog({
        user: req.user,
        action,
        module,
        description: `${req.user.name} performed ${action} on ${module}`,
        req,
      });
    }
  });
  next();
};

module.exports = { createActivityLog, activityLogger };
