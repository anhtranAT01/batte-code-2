const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { authenticateJWT } = require('./auth.middleware');
router.use(require('./passwordRecovery'));

/**
 * @route   POST /api/auth/register
 * @desc    Register a new student/user account
 * @access  Public
 */
router.post('/register', authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & return JWT token
 * @access  Public
 */
router.post('/login', authController.login);

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user profile & stats
 * @access  Private (Bearer JWT)
 */
router.get('/me', authenticateJWT, authController.getMe);

module.exports = router;
