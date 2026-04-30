const jwt          = require('jsonwebtoken');
const User         = require('../models/User');
const redisService = require('../services/redisService');

const login = async (req, res) => {
  try {
    const { email, password, deviceId } = req.body;

    if (!email || !password) {
      return res.status(400).json({ status: 'error', message: 'Email and password required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }

    // ── Password check ──────────────────────────────────────────
    const passwordMatch = await user.comparePassword(password);
    if (!passwordMatch) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }

    // ── Block check ─────────────────────────────────────────────
    if (user.isBlocked) {
      return res.status(403).json({
        status: 'error', code: 'ACCOUNT_BLOCKED',
        message: 'Your account has been blocked. Contact administrator.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        status: 'error', code: 'USER_INACTIVE',
        message: 'Account is inactive. Contact administrator.',
      });
    }

    // ── Subscription check (non-admin only) ─────────────────────
    if (user.role !== 'admin') {
      const sub = user.subscription;
      if (!sub || !sub.isActive || !sub.endDate || new Date() > new Date(sub.endDate)) {
        return res.status(403).json({
          status: 'error', code: 'SUBSCRIPTION_EXPIRED',
          message: 'Subscription expired or not assigned. Contact administrator.',
        });
      }
    }

    // ── Device binding ──────────────────────────────────────────
    // Admin accounts are exempt from device binding
    if (user.role !== 'admin') {
      if (!deviceId) {
        return res.status(400).json({
          status: 'error', code: 'DEVICE_ID_REQUIRED',
          message: 'Device ID is required',
        });
      }

      if (user.deviceId && user.deviceId !== deviceId) {
        // Device mismatch — this account is bound to a different device
        return res.status(403).json({
          status: 'error', code: 'DEVICE_MISMATCH',
          message: 'This account is registered to a different device. Contact administrator to reset device binding.',
        });
      }

      // First login — bind device
      if (!user.deviceId) {
        user.deviceId = deviceId;
      }
    }

    // ── Generate token ──────────────────────────────────────────
    const sessionExpiry = 24 * 60 * 60; // 24 hours in seconds
    const expiresAt     = new Date(Date.now() + sessionExpiry * 1000);

    const token = jwt.sign(
      {
        userId:        user._id,
        id:            user._id,
        email:         user.email,
        role:          user.role,
        deviceId:      deviceId || null,
        sessionExpiry: expiresAt.toISOString(),
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: `${sessionExpiry}s` }
    );

    // ── Update user record ──────────────────────────────────────
    user.lastLogin = new Date();
    user.lastSeen  = new Date();

    // Auto-disable expired subscription
    if (user.subscription?.endDate && new Date() > new Date(user.subscription.endDate)) {
      user.subscription.isActive = false;
    }

    await user.save();

    // Store session in Redis so we can invalidate it on logout
await redisService.setSession(user._id.toString(), token, sessionExpiry);

    return res.json({
      status:  'success',
      message: 'Login successful',
      data: {
        token,
        expiresAt: expiresAt.toISOString(),
        user: {
          id:           user._id,
          email:        user.email,
          name:         user.name,
          businessName: user.businessName,
          phone:        user.phone        || user.businessPhone || '',
          address:      user.address      || user.businessAddress || '',
          ntn:          user.ntn          || '',
          strn:         user.strn         || '',
          role:         user.role,
          subscription: {
            plan:      user.subscription?.plan    || 'monthly',
            endDate:   user.subscription?.endDate,
            isActive:  user.subscription?.isActive || false,
          },
          fbrConnected: user.fbrCredentials?.isConnected || false,
          deviceBound:  !!user.deviceId,
        },
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ status: 'error', message: 'Login failed' });
  }
};

const logout = async (req, res) => {
  try {
    if (req.user) {
      const userId = req.user._id || req.user.id;
      // Update lastSeen
      await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
      // Invalidate Redis session so token can't be reused
      await redisService.invalidateSession(userId.toString());
    }
    res.json({ status: 'success', message: 'Logged out successfully' });
  } catch {
    res.json({ status: 'success', message: 'Logged out successfully' });
  }
};

const verifyToken = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId || req.user.id).select('-password');
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

    res.json({
      status: 'success',
      data: { valid: true, user: { id: user._id, email: user.email, name: user.name, role: user.role } },
    });
  } catch {
    res.status(500).json({ status: 'error', message: 'Token verification failed' });
  }
};

const refreshToken = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId || req.user.id);
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

    const sessionExpiry = 24 * 60 * 60;
    const expiresAt     = new Date(Date.now() + sessionExpiry * 1000);

    const token = jwt.sign(
      { userId: user._id, id: user._id, email: user.email, role: user.role, sessionExpiry: expiresAt.toISOString() },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: `${sessionExpiry}s` }
    );

    res.json({ status: 'success', data: { token, expiresAt: expiresAt.toISOString() } });
  } catch {
    res.status(500).json({ status: 'error', message: 'Token refresh failed' });
  }
};

module.exports = { login, logout, verifyToken, refreshToken };