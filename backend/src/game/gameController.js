/**
 * Game Controller - HTTP Request Handlers
 */

const gameService = require('./gameService');

async function createPractice(req, res, next) {
  try {
    const { boardSize = 8, difficulty = 'medium', botLevel = 'MEDIUM' } = req.body;
    const userId = req.user?.id || null;
    const userName = req.user?.username || 'Student Player';

    const matchData = await gameService.createPracticeMatch({
      userId,
      userName,
      boardSize: Number(boardSize),
      difficulty,
      botLevel,
    });

    return res.status(201).json({
      success: true,
      message: 'Khởi tạo trận đấu luyện tập thành công!',
      data: matchData,
    });
  } catch (err) {
    next(err);
  }
}

async function makeMove(req, res, next) {
  try {
    const { matchId, move, executionTimeMs } = req.body;

    if (!matchId || !move) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin matchId hoặc move { fromRow, fromCol, toRow, toCol }',
      });
    }

    const result = await gameService.submitPlayerMove({
      matchId,
      move,
      executionTimeMs,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function getReplay(req, res, next) {
  try {
    const { matchId } = req.params;
    const replay = await gameService.getReplay(matchId);

    if (!replay) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy bản ghi Replay cho trận đấu ${matchId}`,
      });
    }

    return res.status(200).json({
      success: true,
      data: replay,
    });
  } catch (err) {
    next(err);
  }
}

async function getMap(req, res, next) {
  try {
    const { size = 8, difficulty = 'medium' } = req.query;
    const map = gameService.previewMap(size, difficulty);

    return res.status(200).json({
      success: true,
      data: map,
    });
  } catch (err) {
    next(err);
  }
}

async function getRecentMatches(req, res, next) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
    const matches = await gameService.getRecentMatches(limit);
    return res.status(200).json({
      success: true,
      data: matches,
    });
  } catch (err) {
    next(err);
  }
}

async function getLeaderboard(req, res, next) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    const leaderboard = await gameService.getLeaderboard(limit);
    return res.status(200).json({
      success: true,
      data: leaderboard,
    });
  } catch (err) {
    next(err);
  }
}

async function runAutomatedDuel(req, res, next) {
  try {
    if (req.body.bot2Id) return res.status(400).json({success:false,
      message:'Đấu PvP phải chọn người chơi; hệ thống sẽ dùng bot chính do họ kích hoạt.'});
    const { bot1Id, bot2Level = 'MEDIUM', bot2Id, boardSize = 9, difficulty = 'medium' } = req.body;
    const userId = req.user?.id || null;
    const userName = req.user?.username || 'Kỳ Thủ Khách';

    const result = await gameService.runAutomatedBotDuel({
      userId,
      userName,
      bot1Id,
      bot2Level,
      bot2Id,
      boardSize: Number(boardSize),
      difficulty,
    });

    return res.status(200).json({
      success: true,
      message: 'Trận đấu bot tự động hoàn tất!',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function runPvPDuel(req, res, next) {
  try {
    if (req.body.bot1Id || req.body.bot2Id) return res.status(400).json({success:false,
      message:'Không chọn bot hộ người chơi. Trận PvP dùng bot chính của mỗi người.'});
    const data = await gameService.runPvPDuel({
      userId:req.user.id,userName:req.user.username,opponentUserId:req.body.opponentUserId,
      boardSize:Number(req.body.boardSize || 9),
    });
    return res.json({success:true,data});
  } catch (error) { next(error); }
}

module.exports = {
  createPractice,
  makeMove,
  getReplay,
  getMap,
  getRecentMatches,
  getLeaderboard,
  runAutomatedDuel,
  runPvPDuel,
};
