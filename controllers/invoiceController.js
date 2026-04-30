const Invoice = require('../models/Invoice');
const User    = require('../models/User');
const fbrService = require('../services/fbrService');

// ── Helper: generate invoice number ──────────────────────────────
function generateInvoiceNo() {
  const ts  = Date.now().toString().slice(-8);
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INV-${ts}-${rnd}`;
}

// ── Helper: map invoice document → API response shape ────────────
function _mapInvoice(inv) {
  return {
    _id:          inv._id,
    id:           inv._id,
    localId:      inv.localId,
    invoiceNo:    inv.invoiceNo || inv.invoiceNumber || inv.localId,
    invoiceDate:  inv.invoiceDate,
    dueDate:      inv.dueDate,
    customerName: inv.customerName || inv.customer?.name,
    customer:     inv.customer,
    items:        inv.items,
    subtotal:     inv.subtotal,
    totalTax:     inv.totalTax,
    discount:     inv.discount,
    grandTotal:   inv.grandTotal,
    totals: {
      subtotal: inv.subtotal,
      tax:      inv.totalTax,
      discount: inv.discount,
      total:    inv.grandTotal,
    },
    paymentMethod: inv.paymentMethod,
    notes:         inv.notes,
    status:        inv.status,
    fbrRefNo:      inv.fbrData?.invoiceRefNo,
    fbrQrCode:     inv.fbrData?.qrCode,
    createdAt:     inv.createdAt,
  };
}

// ── POST /api/invoices ────────────────────────────────────────────
const createInvoice = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const {
      invoiceDate, dueDate,
      customerName, customer,
      items, totals,
      paymentMethod, notes,
      localId, invoiceNo,
    } = req.body;

    // ── Resolve customer name ──────────────────────────────────
    const custName = customerName || customer?.name;
    if (!custName) {
      return res.status(400).json({ status: 'error', message: 'Customer name is required' });
    }
    if (!invoiceDate) {
      return res.status(400).json({ status: 'error', message: 'Invoice date is required' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ status: 'error', message: 'At least one item is required' });
    }

    // ── Normalize items ────────────────────────────────────────
    const normItems = items.map(item => {
      const qty      = parseFloat(item.quantity)           || 1;
      const price    = parseFloat(item.unitPrice)          || 0;
      const taxRate  = parseFloat(item.taxRate ?? item.tax) || 0;
      const base     = qty * price;
      const taxAmt   = base * (taxRate / 100);
      return {
        description: item.description,
        quantity:    qty,
        unitPrice:   price,
        taxRate,
        taxAmount:   parseFloat(item.taxAmount?.toFixed(2))   || parseFloat(taxAmt.toFixed(2)),
        totalAmount: parseFloat(item.totalAmount?.toFixed(2)) || parseFloat((base + taxAmt).toFixed(2)),
      };
    });

    // ── Compute totals ─────────────────────────────────────────
    const subtotal   = totals?.subtotal  ?? normItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const totalTax   = totals?.tax       ?? normItems.reduce((s, i) => s + i.taxAmount, 0);
    const discount   = totals?.discount  || 0;
    const grandTotal = totals?.total     ?? (subtotal + totalTax - discount);

    const invoice = new Invoice({
      localId:      localId || `web_${userId}_${Date.now()}`,
      invoiceNo:    invoiceNo || generateInvoiceNo(),
      userId,
      invoiceDate:  new Date(invoiceDate),
      dueDate:      dueDate ? new Date(dueDate) : null,
      customerName: custName,
      customer: {
        name:    custName,
        ntn:     customer?.ntn     || req.body.ntn     || '',
        strn:    customer?.strn    || req.body.strn    || '',
        phone:   customer?.phone   || req.body.phone   || '',
        email:   customer?.email   || req.body.email   || '',
        address: customer?.address || req.body.address || '',
      },
      items:        normItems,
      subtotal,
      totalTax,
      discount,
      grandTotal,
      paymentMethod: paymentMethod || 'cash',
      notes:         notes || '',
      status:        'PENDING',
    });

    await invoice.save();
    await User.findByIdAndUpdate(userId, { lastSync: new Date() });

    return res.status(201).json({
      status:  'success',
      message: 'Invoice created',
      data:    { invoice: _mapInvoice(invoice) },
    });
  } catch (err) {
    console.error('Create invoice error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to create invoice' });
  }
};

// ── POST /api/invoices/sync ───────────────────────────────────────
const syncInvoices = async (req, res) => {
  try {
    const { invoices } = req.body;
    const userId = req.user._id || req.user.id;

    if (!invoices || !Array.isArray(invoices) || invoices.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No invoices provided' });
    }

    const user   = await User.findById(userId);
    const hasFBR = user.fbrCredentials?.isConnected && user.fbrCredentials?.apiKey;
    const results = [];

    for (const inv of invoices) {
      try {
        let existing = await Invoice.findOne({ userId, localId: inv.localId });

        if (!existing) {
          const custName = inv.customerName || inv.customer?.name || 'Unknown';
          existing = new Invoice({
            localId:      inv.localId,
            invoiceNo:    inv.invoiceNo || generateInvoiceNo(),
            userId,
            invoiceDate:  new Date(inv.invoiceDate),
            dueDate:      inv.dueDate ? new Date(inv.dueDate) : null,
            customerName: custName,
            customer:     { name: custName, ...inv.customer },
            items:        inv.items || [],
            subtotal:     inv.subtotal    || 0,
            totalTax:     inv.totalTax    || inv.total_tax || 0,
            discount:     inv.discount    || 0,
            grandTotal:   inv.grandTotal  || inv.grand_total || 0,
            paymentMethod: inv.paymentMethod || 'cash',
            notes:         inv.notes || '',
            status:        'SYNCED',
          });
        } else if (existing.status === 'VERIFIED') {
          results.push({ localId: inv.localId, status: 'VERIFIED', message: 'Already verified' });
          continue;
        } else {
          existing.status = 'SYNCED';
        }

        existing.syncedAt     = new Date();
        existing.syncAttempts = (existing.syncAttempts || 0) + 1;

        if (hasFBR) {
          try {
            const fbrResult = await fbrService.submitInvoice(user.fbrCredentials, {
              ...inv,
              grandTotal: inv.grandTotal || inv.grand_total,
            });
            existing.status     = 'VERIFIED';
            existing.invoiceNo  = fbrResult.invoiceRefNo;
            existing.fbrData    = {
              invoiceRefNo:    fbrResult.invoiceRefNo,
              qrCode:          fbrResult.qrCode,
              verificationUrl: fbrResult.verificationUrl,
              submittedAt:     new Date(),
              response:        fbrResult.rawResponse,
            };
            results.push({
              localId:      inv.localId,
              status:       'VERIFIED',
              invoiceRefNo: fbrResult.invoiceRefNo,
              qrCode:       fbrResult.qrCode,
            });
          } catch (fbrErr) {
            existing.status        = 'SYNCED';
            existing.lastSyncError = fbrErr.message;
            results.push({ localId: inv.localId, status: 'SYNCED', message: `FBR failed: ${fbrErr.message}` });
          }
        } else {
          results.push({ localId: inv.localId, status: 'SYNCED', message: 'Synced. FBR not configured.' });
        }

        await existing.save();
      } catch (invoiceErr) {
        results.push({ localId: inv.localId, status: 'ERROR', message: invoiceErr.message });
      }
    }

    await User.findByIdAndUpdate(userId, { lastSync: new Date() });

    return res.json({
      status:  'success',
      message: `Processed ${invoices.length} invoice(s)`,
      data: {
        results,
        synced:   results.filter(r => r.status === 'SYNCED').length,
        verified: results.filter(r => r.status === 'VERIFIED').length,
      },
    });
  } catch (err) {
    console.error('Sync error:', err);
    return res.status(500).json({ status: 'error', message: 'Sync failed' });
  }
};

// ── GET /api/invoices ─────────────────────────────────────────────
const getInvoices = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { page = 1, limit = 50, status, search, dateFrom, dateTo } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = { userId };
    if (status) query.status = status.toUpperCase();
    if (search) query.$or = [
      { customerName:  { $regex: search, $options: 'i' } },
      { invoiceNo:     { $regex: search, $options: 'i' } },
      { localId:       { $regex: search, $options: 'i' } },
    ];
    if (dateFrom || dateTo) {
      query.invoiceDate = {};
      if (dateFrom) query.invoiceDate.$gte = new Date(dateFrom);
      if (dateTo)   query.invoiceDate.$lte = new Date(dateTo);
    }

    const [invoices, total] = await Promise.all([
      Invoice.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Invoice.countDocuments(query),
    ]);

    return res.json({
      status: 'success',
      data: {
        invoices:   invoices.map(_mapInvoice),
        pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    console.error('Get invoices error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to fetch invoices' });
  }
};

// ── GET /api/invoices/:id ─────────────────────────────────────────
const getInvoice = async (req, res) => {
  try {
    const userId  = req.user._id || req.user.id;
    const invoice = await Invoice.findOne({ _id: req.params.id, userId });
    if (!invoice) return res.status(404).json({ status: 'error', message: 'Invoice not found' });
    return res.json({ status: 'success', data: { invoice: _mapInvoice(invoice) } });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch invoice' });
  }
};

// ── PUT /api/invoices/:id ─────────────────────────────────────────
const updateInvoice = async (req, res) => {
  try {
    const userId  = req.user._id || req.user.id;
    const invoice = await Invoice.findOne({ _id: req.params.id, userId });
    if (!invoice) return res.status(404).json({ status: 'error', message: 'Invoice not found' });
    if (invoice.status === 'VERIFIED') {
      return res.status(400).json({ status: 'error', message: 'Cannot edit a FBR-verified invoice' });
    }

    const { invoiceDate, dueDate, customer, customerName, items, totals, paymentMethod, notes } = req.body;

    if (invoiceDate)  invoice.invoiceDate  = new Date(invoiceDate);
    if (dueDate !== undefined) invoice.dueDate = dueDate ? new Date(dueDate) : null;
    if (customerName || customer?.name) {
      invoice.customerName = customerName || customer.name;
    }
    if (customer)      invoice.customer     = { ...invoice.customer.toObject?.() ?? {}, ...customer };
    if (paymentMethod) invoice.paymentMethod = paymentMethod;
    if (notes !== undefined) invoice.notes  = notes;

    if (items && Array.isArray(items)) {
      invoice.items      = items;
      invoice.subtotal   = totals?.subtotal  ?? items.reduce((s, i) => s + (i.unitPrice || 0) * (i.quantity || 1), 0);
      invoice.totalTax   = totals?.tax       ?? 0;
      invoice.discount   = totals?.discount  ?? 0;
      invoice.grandTotal = totals?.total     ?? (invoice.subtotal + invoice.totalTax - invoice.discount);
    }

    invoice.status = 'PENDING';
    await invoice.save();

    return res.json({ status: 'success', message: 'Invoice updated', data: { invoice: _mapInvoice(invoice) } });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to update invoice' });
  }
};

// ── DELETE /api/invoices/:id ──────────────────────────────────────
const deleteInvoice = async (req, res) => {
  try {
    const userId  = req.user._id || req.user.id;
    const invoice = await Invoice.findOne({ _id: req.params.id, userId });
    if (!invoice) return res.status(404).json({ status: 'error', message: 'Invoice not found' });
    if (invoice.status === 'VERIFIED') {
      return res.status(400).json({ status: 'error', message: 'Cannot delete a FBR-verified invoice' });
    }
    await Invoice.deleteOne({ _id: req.params.id });
    return res.json({ status: 'success', message: 'Invoice deleted' });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to delete invoice' });
  }
};

// ── POST /api/invoices/:id/retry-fbr ─────────────────────────────
const retryFBR = async (req, res) => {
  try {
    const userId  = req.user._id || req.user.id;
    const invoice = await Invoice.findOne({ _id: req.params.id, userId });
    if (!invoice) return res.status(404).json({ status: 'error', message: 'Invoice not found' });
    if (invoice.status === 'VERIFIED') {
      return res.json({ status: 'success', message: 'Invoice already verified with FBR' });
    }

    const user = await User.findById(userId);
    if (!user.fbrCredentials?.isConnected) {
      return res.status(400).json({ status: 'error', message: 'FBR not configured for this account' });
    }

    const fbrResult = await fbrService.submitInvoice(user.fbrCredentials, invoice);
    invoice.status    = 'VERIFIED';
    invoice.invoiceNo = fbrResult.invoiceRefNo;
    invoice.fbrData   = {
      invoiceRefNo:    fbrResult.invoiceRefNo,
      qrCode:          fbrResult.qrCode,
      verificationUrl: fbrResult.verificationUrl,
      submittedAt:     new Date(),
      response:        fbrResult.rawResponse,
    };
    invoice.syncAttempts  = (invoice.syncAttempts || 0) + 1;
    invoice.lastSyncError = null;
    await invoice.save();

    return res.json({
      status:  'success',
      message: 'Invoice verified with FBR',
      data:    { invoiceRefNo: fbrResult.invoiceRefNo, qrCode: fbrResult.qrCode },
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: `FBR retry failed: ${err.message}` });
  }
};

// ── GET /api/invoices/all (admin) ─────────────────────────────────
const getAllInvoicesAdmin = async (req, res) => {
  try {
    const { limit = 200, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const invoices = await Invoice.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'name email businessName');

    const total = await Invoice.countDocuments();

    return res.json({
      status: 'success',
      data: {
        invoices: invoices.map(inv => ({
          _id:          inv._id,
          invoiceDate:  inv.invoiceDate,
          customerName: inv.customerName,
          grandTotal:   inv.grandTotal,
          status:       inv.status,
          fbrRefNo:     inv.fbrData?.invoiceRefNo,
          user:         inv.userId,
          createdAt:    inv.createdAt,
        })),
        pagination: { total, page: parseInt(page), limit: parseInt(limit) },
      },
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to fetch invoices' });
  }
};

module.exports = {
  createInvoice,
  syncInvoices,
  getAllInvoicesAdmin,
  getInvoices,
  getInvoice,
  updateInvoice,
  deleteInvoice,
  retryFBR,
};