const User = require('../models/User');
const { createActivityLog } = require('../middleware/activityLog');
const logger = require('../utils/logger');

/**
 * @desc    Get all users (admin only)
 * @route   GET /api/users
 */
const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role = '', search = '' } = req.query;
    const query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      User.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: users,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * @desc    Create user (admin only)
 * @route   POST /api/users
 */
const createUser = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already registered.' });

    const user = await User.create({ name, email, password, role, phone, createdBy: req.user._id });

    await createActivityLog({
      user: req.user,
      action: 'CREATE',
      module: 'Users',
      description: `Admin created user: ${name} (${role})`,
      details: { userId: user._id, email, role },
      req,
      severity: 'high',
    });

    res.status(201).json({ success: true, message: 'User created successfully.', data: user });
  } catch (error) {
    logger.error('Create user error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error.' });
  }
};

/**
 * @desc    Update user
 * @route   PUT /api/users/:id
 */
const updateUser = async (req, res) => {
  try {
    const { password, ...updateData } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (password) {
      user.password = password;
      await user.save();
    }

    await createActivityLog({
      user: req.user,
      action: 'UPDATE',
      module: 'Users',
      description: `Admin updated user: ${user.name}`,
      req,
      severity: 'high',
    });

    res.status(200).json({ success: true, message: 'User updated.', data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * @desc    Delete user
 * @route   DELETE /api/users/:id
 */
const deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account.' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    await createActivityLog({
      user: req.user,
      action: 'DELETE',
      module: 'Users',
      description: `Admin deleted user: ${user.name} (${user.email})`,
      req,
      severity: 'high',
    });

    res.status(200).json({ success: true, message: 'User deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * @desc    Toggle user active status
 * @route   PUT /api/users/:id/toggle-status
 */
const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    user.isActive = !user.isActive;
    await user.save();

    await createActivityLog({
      user: req.user,
      action: 'UPDATE',
      module: 'Users',
      description: `Admin ${user.isActive ? 'activated' : 'deactivated'} user: ${user.name}`,
      req,
      severity: 'high',
    });

    res.status(200).json({ success: true, message: `User ${user.isActive ? 'activated' : 'deactivated'}.`, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getUsers, createUser, updateUser, deleteUser, toggleUserStatus };
