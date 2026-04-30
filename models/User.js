const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({

  // ── Core ──────────────────────────────────────────────────────
  email: {
    type: String, required: true, unique: true,
    lowercase: true, trim: true,
  },
  password: { type: String, required: true },
  name:     { type: String, required: true },
  role:     { type: String, enum: ['user', 'admin'], default: 'user' },

  // ── Business info ─────────────────────────────────────────────
  businessName:    { type: String, default: '' },
  businessEmail:   { type: String, default: '' },
  phone:           { type: String, default: '' }, // primary phone
  businessPhone:   { type: String, default: '' }, // alias kept for compatibility
  address:         { type: String, default: '' }, // primary address
  businessAddress: { type: String, default: '' }, // alias kept for compatibility
  ntn:             { type: String, default: '' },
  strn:            { type: String, default: '' },

  // ── Status ────────────────────────────────────────────────────
  isActive:  { type: Boolean, default: true  },
  isBlocked: { type: Boolean, default: false },

  // ── Device binding ────────────────────────────────────────────
  deviceId:          { type: String, default: null },
  deviceFingerprint: { type: String, default: null },

  // ── Subscription ──────────────────────────────────────────────
  subscription: {
    plan:       { type: String, enum: ['monthly', 'quarterly', 'yearly', 'free'], default: 'monthly' },
    startDate:  { type: Date, default: null },
    endDate:    { type: Date, default: null },
    isActive:   { type: Boolean, default: false },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },

  // ── FBR Credentials (stored encrypted) ───────────────────────
  fbrCredentials: {
    isConnected: { type: Boolean, default: false },
    ntn:         { type: String,  default: '' },
    strn:        { type: String,  default: '' },
    apiKey:      { type: String,  default: '' },
    apiSecret:   { type: String,  default: '' },
    environment: { type: String,  enum: ['sandbox', 'production'], default: 'sandbox' },
    lastSync:    { type: Date,    default: null },
    syncStatus:  { type: String,  enum: ['pending', 'success', 'failed'], default: 'pending' },
  },

  // ── Activity tracking ─────────────────────────────────────────
  lastLogin: { type: Date, default: null },
  lastSeen:  { type: Date, default: null }, // updated by heartbeat every 30s
  lastSync:  { type: Date, default: null },

}, { timestamps: true });

// ── Hash password before saving ───────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) { next(err); }
});

// ── Instance methods ──────────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.isSubscriptionValid = function () {
  return (
    this.subscription?.isActive &&
    this.subscription?.endDate &&
    new Date() < new Date(this.subscription.endDate)
  );
};

userSchema.methods.isOnline = function () {
  if (!this.lastSeen) return false;
  return Date.now() - new Date(this.lastSeen).getTime() < 60000; // 60 seconds
};

module.exports = mongoose.model('User', userSchema);