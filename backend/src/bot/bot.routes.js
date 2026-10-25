const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const os = require('os');
const botController = require('./bot.controller');
const { authenticateJWT } = require('../auth/auth.middleware');

// Configure multer temporary upload destination
const upload = multer({
  dest: path.join(os.tmpdir(), 'rps_bot_uploads'),
  limits: {
    fileSize: 2 * 1024 * 1024, // Max 2MB per Python file
  },
  fileFilter: (req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith('.py')) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file mã nguồn Python (.py).'));
    }
  },
});

/**
 * @route   POST /api/bots/upload
 * @desc    Upload Python bot file (.py)
 * @access  Private
 */
router.post('/upload', authenticateJWT, upload.single('file'), botController.uploadBot);

/**
 * @route   POST /api/bots/create
 * @desc    Create Python bot directly with code string or template
 * @access  Private
 */
router.post('/create', authenticateJWT, botController.createBot);

/**
 * @route   PATCH /api/bots/:id/tactic
 * @desc    Change tactic (chiến thuật) for a specific bot
 * @access  Private
 */
router.patch('/:id/tactic', authenticateJWT, botController.changeTactic);

/**
 * @route   POST /api/bots/git
 * @desc    Submit Git URL for Bot repository
 * @access  Private
 */
router.post('/git', authenticateJWT, botController.submitGitBot);

/**
 * @route   GET /api/bots/my-bots
 * @desc    Get all bots uploaded by current student
 * @access  Private
 */
router.get('/my-bots', authenticateJWT, botController.listMyBots);

/**
 * @route   GET /api/bots/templates
 * @desc    Get sample algorithm templates (Alpha-Beta, A* Flag Rusher, Greedy)
 * @access  Public
 */
router.get('/templates', botController.getTemplates);

/**
 * @route   GET /api/bots/community
 * @desc    Get all active student bots in the community for PvP matches
 * @access  Public
 */
router.get('/community', botController.listCommunityBots);
router.get('/players', botController.listPlayers);

/**
 * @route   GET /api/bots/:id
 * @desc    Get single bot details
 * @access  Private
 */
router.get('/:id', authenticateJWT, botController.getBot);

/**
 * @route   POST /api/bots/:id/activate
 * @desc    Set a bot as active for duels and tournaments
 * @access  Private
 */
router.post('/:id/activate', authenticateJWT, botController.activateBot);

/**
 * @route   DELETE /api/bots/:id
 * @desc    Delete a bot
 * @access  Private
 */
router.delete('/:id', authenticateJWT, botController.removeBot);

module.exports = router;
