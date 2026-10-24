const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { authenticateJWT, requireRole } = require('../auth/auth.middleware');

// All admin routes require ADMIN or TEACHER role
router.use(authenticateJWT, requireRole('ADMIN', 'TEACHER'));

/**
 * @route   GET /api/admin/users
 * @desc    List all users with stats
 */
router.get('/users', adminController.listUsers);

/**
 * @route   PUT /api/admin/users/:id/role
 * @desc    Update user role (STUDENT, TEACHER, ADMIN)
 */
router.put('/users/:id/role', adminController.updateUserRole);

/**
 * @route   PUT /api/admin/users/:id/elo
 * @desc    Adjust user Elo rating
 */
router.put('/users/:id/elo', adminController.updateUserElo);

/**
 * @route   GET /api/admin/bots
 * @desc    List all bots across all students
 */
router.get('/bots', adminController.listAllBots);

/**
 * @route   DELETE /api/admin/bots/:id
 * @desc    Delete a bot from system
 */
router.delete('/bots/:id', adminController.adminDeleteBot);

/**
 * @route   POST /api/admin/tournaments/grade
 * @desc    Create a grade tournament (Khối 10, Khối 11, Toàn Trường)
 */
router.post('/tournaments/grade', adminController.createGradeTournament);

/**
 * @route   POST /api/admin/tournaments/university
 * @desc    Create university tournament (All-In or Branches)
 */
router.post('/tournaments/university', adminController.createUniversityTournament);

/**
 * @route   PATCH /api/admin/tournaments/:id/brackets/assign
 * @desc    Assign student or bot to bracket slot
 */
router.patch('/tournaments/:id/brackets/assign', adminController.assignBracketSlot);

/**
 * @route   POST /api/admin/tournaments/:id/brackets/run-all
 * @desc    Run all pending bracket matches automatically
 */
router.post('/tournaments/:id/brackets/run-all', adminController.runBracketMatches);

/**
 * @route   POST /api/admin/tournaments/:id/batch-grade
 * @desc    Trigger automated batch grading for all bots in tournament
 */
router.post('/tournaments/:id/batch-grade', adminController.batchGradeTournament);

/**
 * @route   DELETE /api/admin/tournaments/:id
 * @desc    Delete tournament
 */
router.delete('/tournaments/:id', adminController.deleteTournament);

/**
 * @route   GET /api/admin/stats
 * @desc    Get system metrics & BullMQ queue statistics
 */
router.get('/stats', adminController.getSystemStats);

module.exports = router;
