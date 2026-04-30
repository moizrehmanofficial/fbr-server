const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity:    { type: Number, required: true, min: 0 },
  unitPrice:   { type: Number, required: true, min: 0 },
  taxRate:     { type: Number, default: 0 },
  taxAmount:   { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
}, { _id: false });

const customerSchema = new mongoose.Schema({
  name:    { type: String, required: true },
  ntn:     { type: String, default: '' },
  strn:    { type: String, default: '' },
  phone:   { type: String, default: '' },
  email:   { type: String, default: '' },
  address: { type: String, default: '' },
}, { _id: false });

const fbrDataSchema = new mongoose.Schema({
  invoiceRefNo:    { type: String, default: null },
  qrCode:          { type: String, default: null },
  verificationUrl: { type: String, default: null },
  submittedAt:     { type: Date,   default: null },
  response:        { type: mongoose.Schema.Types.Mixed, default: null },
}, { _id: false });

const invoiceSchema = new mongoose.Schema({

  // ── Identity ───────────────────────────────────────────────────
  localId: {
    type:  String,
    index: true,
  },
  invoiceNo: {
    type:    String,
    default: null,
  },

  // ── Relations ──────────────────────────────────────────────────
  userId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
    index:    true,
  },

  // ── Customer ───────────────────────────────────────────────────
  customerName: {
    type:     String,
    required: true,
  },
  customer: {
    type: customerSchema,
    default: () => ({}),
  },

  // ── Dates ──────────────────────────────────────────────────────
  invoiceDate: { type: Date, required: true },
  dueDate:     { type: Date, default: null  },

  // ── Items ──────────────────────────────────────────────────────
  items: { type: [itemSchema], default: [] },

  // ── Totals ─────────────────────────────────────────────────────
  subtotal:   { type: Number, default: 0 },
  totalTax:   { type: Number, default: 0 },
  discount:   { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },

  // ── Payment ────────────────────────────────────────────────────
  paymentMethod: {
    type:    String,
    enum:    ['cash', 'card', 'bank_transfer', 'cheque', 'online', 'other'],
    default: 'cash',
  },

  // ── Notes ──────────────────────────────────────────────────────
  notes: { type: String, default: '' },

  // ── Status ─────────────────────────────────────────────────────
  status: {
    type:    String,
    enum:    ['PENDING', 'SYNCED', 'VERIFIED', 'ERROR'],
    default: 'PENDING',
    index:   true,
  },

  // ── FBR Data ───────────────────────────────────────────────────
  fbrData: { type: fbrDataSchema, default: null },

  // ── Sync tracking ──────────────────────────────────────────────
  syncedAt:      { type: Date,   default: null },
  syncAttempts:  { type: Number, default: 0    },
  lastSyncError: { type: String, default: null },

}, { timestamps: true });

// ── Indexes ────────────────────────────────────────────────────────
invoiceSchema.index({ userId: 1, createdAt: -1 });
invoiceSchema.index({ userId: 1, localId: 1 }, { sparse: true });
invoiceSchema.index({ invoiceNo: 1 }, { sparse: true });

module.exports = mongoose.model('Invoice', invoiceSchema);