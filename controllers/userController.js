const User   = require('../models/User');
const bcrypt = require('bcryptjs');

// PUT /api/users/profile
const updateProfile = async (req, res) => {
  try {
    const { name, businessName, phone, address, ntn, strn } = req.body;
    const user = await User.findById(req.user._id || req.user.id);
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

    if (name)            user.name         = name.trim();
    if (businessName !== undefined) user.businessName = businessName;
    if (phone        !== undefined) user.phone        = phone;
    if (address      !== undefined) user.address      = address;
    if (ntn          !== undefined) user.ntn          = ntn;
    if (strn         !== undefined) user.strn         = strn;

    await user.save();

    const out = user.toObject();
    delete out.password;
    res.json({ status: 'success', message: 'Profile updated', data: { user: out } });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to update profile' });
  }
};

// PUT /api/users/change-password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ status: 'error', message: 'Both passwords are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ status: 'error', message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id || req.user.id);
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json({ status: 'error', message: 'Current password is incorrect' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ status: 'success', message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to change password' });
  }
};

// GET /api/users/profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id || req.user.id).select('-password');
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
    res.json({ status: 'success', data: { user } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch profile' });
  }
};

module.exports = { updateProfile, changePassword, getProfile };