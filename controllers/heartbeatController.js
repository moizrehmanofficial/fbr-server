const User = require('../models/User');

// POST /api/user/heartbeat
const heartbeat = async (req, res) => {
  try {
    await User.findByIdAndUpdate(
      req.user._id || req.user.id,
      { lastSeen: new Date() },
      { new: false } // don't need return value, faster
    );
    res.json({ status: 'success', message: 'ok' });
  } catch (err) {
    // Don't error — heartbeat failure shouldn't break the app
    res.json({ status: 'success', message: 'ok' });
  }
};

module.exports = { heartbeat };