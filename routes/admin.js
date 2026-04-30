const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/adminController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// All admin routes require auth + admin role
router.use(authenticate, requireAdmin);

router.get('/stats',                     ctrl.getStats);
router.get('/users',                     ctrl.getUsers);
router.post('/users',                    ctrl.createUser);
router.put('/users/:id',                 ctrl.updateUser);
router.delete('/users/:id',              ctrl.deleteUser);
router.put('/users/:id/block',           ctrl.blockUser);
router.put('/users/:id/unblock',         ctrl.unblockUser);
router.put('/users/:id/subscription',    ctrl.updateSubscription);
router.put('/users/:id/fbr-credentials', ctrl.updateFBRCredentials);
router.post('/users/:id/fbr-test',       ctrl.testFBRConnection);
router.put('/users/:id/reset-device',    ctrl.resetDevice);

module.exports = router;