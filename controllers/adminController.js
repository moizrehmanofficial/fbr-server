const User       = require('../models/User');
const Invoice    = require('../models/Invoice');
const Customer   = require('../models/Customer');
const Product    = require('../models/Product');
const bcrypt     = require('bcryptjs');
const fbrService = require('../services/fbrService');
const { encryptFBRCredentials } = require('../utils/encryption');

// ── Get all users ─────────────────────────────────────────────────────
const getUsers = async (req, res) => {
  try {
    const { limit } = req.query;
    const users = await User.find({ role: { $ne: 'admin' } })
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit ? parseInt(limit) : 0)
      .lean();
    res.json({ status: 'success', data: { users } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to load users' });
  }
};

// ── Create user ───────────────────────────────────────────────────────
const createUser = async (req, res) => {
  try {
    const { name, email, password, businessName, phone, subscriptionStart, subscriptionEnd } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ status: 'error', message: 'Name, email and password are required' });
    }
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ status: 'error', message: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const planMonths = { monthly: 1, quarterly: 3, yearly: 12 };
    const months = planMonths[req.body.plan] || 1;
    const defaultEnd = new Date();
    defaultEnd.setMonth(defaultEnd.getMonth() + months);

    const user = new User({
      name, email, password: hashed,
      businessName: businessName || '',
      phone: phone || '',
      role: 'user',
      isBlocked: false,
      subscription: {
        isActive:  true,
        plan:      req.body.plan || 'monthly',
        startDate: subscriptionStart ? new Date(subscriptionStart) : new Date(),
        endDate:   subscriptionEnd   ? new Date(subscriptionEnd)   : defaultEnd,
      },
    });
    await user.save();
    const out = user.toObject();
    delete out.password;
    res.status(201).json({ status: 'success', data: { user: out } });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to create user' });
  }
};

// ── Block / Unblock ───────────────────────────────────────────────────
const blockUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id, { isBlocked: true }, { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
    res.json({ status: 'success', data: { user } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to block user' });
  }
};

const unblockUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id, { isBlocked: false }, { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
    res.json({ status: 'success', data: { user } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to unblock user' });
  }
};

// ── Update subscription ───────────────────────────────────────────────
const updateSubscription = async (req, res) => {
  try {
    const { startDate, endDate, isActive, plan } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        'subscription.isActive':  isActive  !== undefined ? isActive  : true,
        'subscription.plan':      plan      || 'monthly',
        'subscription.startDate': startDate ? new Date(startDate) : new Date(),
        'subscription.endDate':   endDate   ? new Date(endDate)   : null,
      },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
    res.json({ status: 'success', data: { user } });
  } catch (err) {
    console.error('Update subscription error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to update subscription' });
  }
};

// ── FBR credentials ───────────────────────────────────────────────────
const updateFBRCredentials = async (req, res) => {
  try {
    const { ntn, strn, apiKey, apiSecret, environment } = req.body;
    if (!ntn || !apiKey || !apiSecret) {
      return res.status(400).json({ status: 'error', message: 'NTN, API Key and Secret are required' });
    }
    // Encrypt before saving
const encrypted = encryptFBRCredentials({ ntn, strn: strn || '', apiKey, apiSecret, environment: environment || 'sandbox' });

const user = await User.findByIdAndUpdate(
  req.params.id,
  {
    'fbrCredentials.ntn':         encrypted.ntn,
    'fbrCredentials.strn':        encrypted.strn,
    'fbrCredentials.apiKey':      encrypted.apiKey,
    'fbrCredentials.apiSecret':   encrypted.apiSecret,
    'fbrCredentials.environment': environment || 'sandbox',
    'fbrCredentials.isConnected': true,
  },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
    res.json({ status: 'success', data: { user } });
  } catch (err) {
    console.error('Update FBR credentials error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to update FBR credentials' });
  }
};

// ── Test FBR connection (stub — replace with real FBR ping if needed) ─
const testFBRConnection = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
    if (!user.fbrCredentials?.isConnected || !user.fbrCredentials?.apiKey) {
      return res.status(400).json({ status: 'error', message: 'FBR credentials not set for this user' });
    }

    // Call the real FBR service with the stored (encrypted) credentials
    const result = await fbrService.testConnection(user.fbrCredentials);

    if (result.success) {
      return res.json({
        status:  'success',
        message: result.message,
        data:    result.data,
      });
    } else {
      return res.status(400).json({
        status:  'error',
        message: result.message,
      });
    }
  } catch (err) {
    console.error('FBR test error:', err);
    res.status(500).json({ status: 'error', message: 'FBR test failed: ' + err.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ status: 'error', message: 'Cannot edit admin accounts' });

    const { name, email, businessName, phone, password } = req.body;
    if (name)         user.name         = name.trim();
    if (email)        user.email        = email.trim();
    if (businessName !== undefined) user.businessName = businessName;
    if (phone        !== undefined) user.phone        = phone;
    if (password) {
      if (password.length < 6) return res.status(400).json({ status: 'error', message: 'Password must be at least 6 characters' });
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();
    const out = user.toObject();
    delete out.password;
    res.json({ status: 'success', message: 'User updated', data: { user: out } });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to update user' });
  }
};

// ── Delete user ───────────────────────────────────────────────────────
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ status: 'error', message: 'Cannot delete admin accounts' });

    // Delete all their invoices and customers too
    await Promise.all([
  Invoice.deleteMany({ userId: req.params.id }),
  Customer.deleteMany({ userId: req.params.id }),
  Product.deleteMany({ userId: req.params.id }),
  User.deleteOne({ _id: req.params.id }),
]);

    res.json({ status: 'success', message: 'User and all their data deleted' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to delete user' });
  }
};
const resetDevice = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $unset: { deviceId: '', deviceFingerprint: '' } },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
    res.json({ status: 'success', message: 'Device binding reset', data: { user } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to reset device' });
  }
};

// ── Stats ─────────────────────────────────────────────────────────────
const getStats = async (req, res) => {
  try {
    const [totalUsers, activeUsers, blockedUsers] = await Promise.all([
      User.countDocuments({ role: { $ne: 'admin' } }),
      User.countDocuments({ role: { $ne: 'admin' }, isBlocked: false, 'subscription.isActive': true }),
      User.countDocuments({ role: { $ne: 'admin' }, isBlocked: true }),
    ]);

    res.json({
      status: 'success',
      data: {
        users: {
          total:   totalUsers,
          active:  activeUsers,
          blocked: blockedUsers,
        },
      },
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to load stats' });
  }
};

module.exports = {
  getUsers, createUser, updateUser, deleteUser,
  blockUser, unblockUser,
  updateSubscription, updateFBRCredentials,
  testFBRConnection, resetDevice, getStats,
};