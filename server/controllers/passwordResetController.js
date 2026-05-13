const PasswordResetRequest = require('../models/PasswordResetRequest');
const User = require('../models/User');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { createActivityLog } = require('../middleware/activityLog');
const logger = require('../utils/logger');

const sendResetEmail = async (email, token, userName) => {
  try {
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    await transporter.sendMail({
      from: `"Vardhman Family ERP" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Approved — Vardhman Family ERP',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f0fdf4;padding:30px;border-radius:10px;">
          <div style="background:#166534;padding:20px;border-radius:8px;text-align:center;">
            <h1 style="color:white;margin:0;">Vardhman Family ERP</h1>
          </div>
          <div style="padding:20px;">
            <h2>Hello ${userName},</h2>
            <p>Your password reset request has been <strong>approved by the administrator</strong>.</p>
            <p>Click the button below to reset your password. This link is valid for <strong>1 hour</strong>.</p>
            <div style="text-align:center;margin:30px 0;">
              <a href="${resetUrl}" style="background:#16a34a;color:white;padding:12px 30px;border-radius:6px;text-decoration:none;font-size:16px;">Reset Password</a>
            </div>
            <p style="color:#666;font-size:13px;">If you didn't request this, ignore this email.</p>
          </div>
        </div>
      `,
    });
  } catch (error) {
    logger.error('Email send error:', error.message);
  }
};

/**
 * @desc    User requests password reset (public - no auth required)
 * @route   POST /api/password-reset/request
 */
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No user found with this email.' });
    }

    // Check for pending request
    const existing = await PasswordResetRequest.findOne({ user: user._id, status: 'pending' });
    if (existing) {
      return res.status(400).json({ success: false, message: 'A reset request is already pending admin approval.' });
    }

    const request = await PasswordResetRequest.create({
      user: user._id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
    });

    await createActivityLog({
      user: user,
      action: 'PASSWORD_RESET',
      module: 'PasswordReset',
      description: `${user.name} requested a password reset`,
      req,
      severity: 'medium',
    });

    res.status(201).json({ success: true, message: 'Password reset request submitted. Admin will review and approve.' });
  } catch (error) {
    logger.error('Password reset request error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * @desc    Admin gets all reset requests
 * @route   GET /api/password-reset
 */
const getResetRequests = async (req, res) => {
  try {
    const { status = '' } = req.query;
    const query = status ? { status } : {};
    const requests = await PasswordResetRequest.find(query)
      .populate('user', 'name email role')
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * @desc    Admin approves or rejects reset request
 * @route   PUT /api/password-reset/:id
 */
const handleResetRequest = async (req, res) => {
  try {
    const { action, adminNote } = req.body; // 'approve' or 'reject'
    const request = await PasswordResetRequest.findById(req.params.id).select('+resetToken');
    if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });
    if (request.status !== 'pending') return res.status(400).json({ success: false, message: 'Request already processed.' });

    request.approvedBy = req.user._id;
    request.adminNote = adminNote || '';
    request.resolvedAt = new Date();

    if (action === 'approve') {
      const token = crypto.randomBytes(32).toString('hex');
      request.status = 'approved';
      request.resetToken = token;
      request.resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour
      await request.save();
      await sendResetEmail(request.userEmail, token, request.userName);

      await createActivityLog({
        user: req.user,
        action: 'APPROVE',
        module: 'PasswordReset',
        description: `Admin approved password reset for ${request.userName}`,
        req,
        severity: 'high',
      });

      return res.status(200).json({ success: true, message: `Reset link sent to ${request.userEmail}` });
    }

    request.status = 'rejected';
    await request.save();

    await createActivityLog({
      user: req.user,
      action: 'REJECT',
      module: 'PasswordReset',
      description: `Admin rejected password reset for ${request.userName}`,
      req,
      severity: 'medium',
    });

    res.status(200).json({ success: true, message: 'Reset request rejected.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * @desc    User confirms reset with token
 * @route   POST /api/password-reset/confirm
 */
const confirmPasswordReset = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const request = await PasswordResetRequest.findOne({
      resetToken: token,
      status: 'approved',
      resetTokenExpiry: { $gt: new Date() },
    }).select('+resetToken');

    if (!request) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token.' });
    }

    const user = await User.findById(request.user);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    user.password = newPassword;
    await user.save();

    // Invalidate token
    request.resetToken = null;
    request.resetTokenExpiry = null;
    await request.save();

    res.status(200).json({ success: true, message: 'Password reset successfully. Please login.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { requestPasswordReset, getResetRequests, handleResetRequest, confirmPasswordReset };
