const express = require('express');
const router  = express.Router();
const { authenticate, requireAdmin, requireActiveSubscription } = require('../middleware/auth');
const ctrl = require('../controllers/invoiceController');

// ── Admin-only: ALL invoices across all users ─────────────────────────
// MUST be before /:id — otherwise Express treats "all" as a dynamic param
router.get('/all', authenticate, requireAdmin, ctrl.getAllInvoicesAdmin);

// ── Authenticated + active-subscription routes ────────────────────────
router.use(authenticate, requireActiveSubscription);

router.post('/sync',          ctrl.syncInvoices);
router.post('/',              ctrl.createInvoice);
router.get('/',               ctrl.getInvoices);
router.get('/:id',            ctrl.getInvoice);
router.put('/:id',            ctrl.updateInvoice);
router.delete('/:id',         ctrl.deleteInvoice);
router.post('/:id/retry-fbr', ctrl.retryFBR);

module.exports = router;