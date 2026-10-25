const express = require('express');
const router = express.Router();
const tournamentController = require('./tournament.controller');
const { authenticateJWT, requireRole } = require('../auth/auth.middleware');

/**
 * @route   POST /api/tournaments
 * @desc    Create a new tournament (Admin or Teacher only)
 * @access  Private (ADMIN, TEACHER)
 */
router.post('/', authenticateJWT, requireRole('ADMIN', 'TEACHER'), tournamentController.createTournament);

/**
 * @route   GET /api/tournaments/teams
 * @desc    Get list of unique active teams for search / suggestions
 * @access  Public
 */
router.get('/teams', tournamentController.getTeams);

/**
 * @route   PUT /api/tournaments/team
 * @desc    User updates / renames their team
 * @access  Private (Bearer JWT)
 */
router.put('/team', authenticateJWT, tournamentController.updateTeam);

/**
 * @route   POST /api/tournaments/:id/register
 * @desc    Student registers for a tournament
 * @access  Private (Bearer JWT)
 */
router.post('/:id/register', authenticateJWT, tournamentController.register);

/**
 * @route   POST /api/tournaments/:id/start
 * @desc    Admin starts Round 1 of the tournament
 * @access  Private (ADMIN)
 */
router.post('/:id/start', authenticateJWT, requireRole('ADMIN'), tournamentController.start);

/**
 * @route   GET /api/tournaments/:id/standings
 * @desc    View current tournament standings & metrics
 * @access  Public
 */
router.get('/:id/standings', tournamentController.getStandings);

/**
 * @route   GET /api/tournaments/:id/export/excel
 * @desc    Export tournament report to formatted Excel (.xlsx) file
 * @access  Public
 */
router.get('/:id/export/excel', tournamentController.exportExcel);

/**
 * @route   GET /api/tournaments/:id/export/csv
 * @desc    Export tournament report to CSV file
 * @access  Public
 */
router.get('/:id/export/csv', tournamentController.exportCSV);

/**
 * @route   POST /api/tournaments/matchmaking/join
 * @desc    Join real-time ranked Elo matchmaking queue
 * @access  Private (Bearer JWT)
 */
router.post('/matchmaking/join', authenticateJWT, tournamentController.joinQueue);

/**
 * @route   POST /api/tournaments/matchmaking/leave
 * @desc    Leave ranked matchmaking queue
 * @access  Private (Bearer JWT)
 */
/**
 * @route   GET /api/tournaments
 * @desc    List all tournaments
 * @access  Public
 */
router.get('/', tournamentController.getTournaments);

/**
 * @route   PUT /api/tournaments/:id/schedule
 * @desc    Admin sets or updates scheduled start time
 * @access  Private (ADMIN, TEACHER)
 */
router.put('/:id/schedule', authenticateJWT, requireRole('ADMIN', 'TEACHER'), tournamentController.updateSchedule);

/**
 * @route   PUT /api/tournaments/:id/brackets
 * @desc    Admin assigns participants into bracket seeds/branches
 * @access  Private (ADMIN, TEACHER)
 */
router.put('/:id/brackets', authenticateJWT, requireRole('ADMIN', 'TEACHER'), tournamentController.updateBrackets);

module.exports = router;
