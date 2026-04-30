const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const { heartbeat }    = require('../controllers/heartbeatController');

// No subscription check needed — even expired users should heartbeat
router.post('/heartbeat', authenticate, heartbeat);

module.exports = router;