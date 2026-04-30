const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  userId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
    index:    true,
  },
  name: {
    type:     String,
    required: true,
    trim:     true,
  },
  description: {
    type:    String,
    default: '',
  },
  unitPrice: {
    type:     Number,
    required: true,
    min:      0,
  },
  taxRate: {
    type:    Number,
    default: 0,
    min:     0,
    max:     100,
  },
  unit: {
    type:    String,
    default: 'pcs',
  },
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);