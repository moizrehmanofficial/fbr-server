const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'User',
    required: true,
  },
  name:    { type: String, required: true, trim: true },
  ntn:     { type: String, default: null, trim: true },
  strn:    { type: String, default: null, trim: true },
  phone:   { type: String, default: null, trim: true },
  email:   { type: String, default: null, trim: true, lowercase: true },
  address: { type: String, default: null, trim: true },
}, { timestamps: true });

customerSchema.index({ userId: 1, name: 1 });

module.exports = mongoose.model('Customer', customerSchema);