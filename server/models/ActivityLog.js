const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String },
    userRole: { type: String },
    action: {
      type: String,
      required: true,
      enum: [
        'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT',
        'APPROVE', 'REJECT', 'EXPORT', 'UPLOAD', 'STATUS_CHANGE',
        'PASSWORD_RESET', 'STOCK_UPDATE',
      ],
    },
    module: {
      type: String,
      required: true,
      enum: [
        'Auth', 'Products', 'Suppliers', 'Purchases',
        'Orders', 'Bills', 'Users', 'Reports',
        'Inventory', 'PasswordReset', 'System',
      ],
    },
    description: { type: String, required: true },
    details: { type: mongoose.Schema.Types.Mixed, default: null },
    ipAddress: { type: String },
    userAgent: { type: String },
    severity: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  },
  { timestamps: true }
);

// TTL index - logs auto-expire after 1 year
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 3600 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
