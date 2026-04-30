const jwt  = require('jsonwebtoken');
const User = require('../models/User');

const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    req.token = token;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ status: 'error', code: 'TOKEN_EXPIRED', message: 'Token expired' });
    }
    res.status(401).json({ status: 'error', message: 'Invalid token' });
  }
};

const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id || req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ status: 'error', message: 'Admin access required' });
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Authorization check failed' });
  }
};

const requireActiveSubscription = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id || req.user.id);
    if (!user) return res.status(401).json({ status: 'error', message: 'User not found' });

    // Admins bypass subscription check
    if (user.role === 'admin') { req.user = user; return next(); }

    const subExpired =
  !user.subscription?.isActive ||
  !user.subscription?.endDate  ||
  new Date() > new Date(user.subscription.endDate);

if (user.isBlocked || subExpired) {
  return res.status(403).json({
    status:  'error',
    code:    user.isBlocked ? 'ACCOUNT_BLOCKED' : 'SUBSCRIPTION_EXPIRED',
    message: user.isBlocked
      ? 'Your account has been blocked. Contact administrator.'
      : 'Subscription expired. Contact administrator.',
  });
}
    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Subscription check failed' });
  }
};

// Keep verifyToken as alias so nothing else breaks
const verifyToken = authenticate;

module.exports = { authenticate, requireAdmin, requireActiveSubscription, verifyToken };