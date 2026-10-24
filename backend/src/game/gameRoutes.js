const express = require('express');
const router = express.Router();
const gameController = require('./gameController');

// Optional auth token parser (if present, attaches req.user, otherwise allows guest)
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_tactical_rps_2026_x892k';

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch {
      // Ignore token parse failure for guest mode
    }
  }
  next();
}

/**
 * @route   POST /api/game/practice/create
 * @desc    Initialize a practice match with Easy/Medium/Hard Bot
 * @access  Public / Authenticated
 */
router.post('/practice/create', optionalAuth, gameController.createPractice);

/**
 * @route   POST /api/game/practice/move
 * @desc    Submit player move and receive Bot's counter-move
 * @access  Public / Authenticated
 */
router.post('/practice/move', gameController.makeMove);

/**
 * @route   GET /api/game/replay/:matchId
 * @desc    Get detailed Replay JSON of a match
 * @access  Public
 */
router.get('/replay/:matchId', gameController.getReplay);

/**
 * @route   GET /api/game/maps
 * @desc    Preview or generate symmetrical tactical maps (8x8, 9x9, easy, medium, hard, random)
 * @access  Public
 */
router.get('/maps', gameController.getMap);

/**
 * @route   GET /api/game/recent-matches
 * @desc    Get latest FFA matches with player details
 * @access  Public
 */
router.get('/recent-matches', gameController.getRecentMatches);

router.get('/leaderboard', gameController.getLeaderboard);

/**
 * @route   POST /api/game/bot-vs-bot
 * @desc    Run automated simulation match between two bots (Python bot vs Boss or Bot vs Bot)
 * @access  Public / Authenticated
 */
router.post('/bot-vs-bot', optionalAuth, gameController.runAutomatedDuel);

module.exports = router;
