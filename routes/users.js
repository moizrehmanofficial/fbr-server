const express = require('express');
const router  = express.Router();
const { authenticate, requireActiveSubscription } = require('../middleware/auth');
const { updateProfile, changePassword, getProfile } = require('../controllers/userController');

router.use(authenticate, requireActiveSubscription);

router.get('/profile',         getProfile);
router.put('/profile',         updateProfile);
router.put('/change-password', changePassword);

module.exports = router;