const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

router.post('/login', authController.login);
router.post('/logout', verifyToken, authController.logout);
router.get('/verify', verifyToken, authController.verifyToken);
router.post('/refresh', verifyToken, authController.refreshToken);

module.exports = router;