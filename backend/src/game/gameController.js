/**
 * Game Controller - HTTP Request Handlers
 */

const gameService = require('./gameService');
const { respondWithDuel } = require('./duelResponse');

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

    res.set('Cache-Control','no-store').vary('Accept-Encoding');
    const payload=JSON.stringify({success:true,data:replay});
    if(Buffer.byteLength(payload)>1024 && req.acceptsEncodings('gzip')) {
      const compressed=await require('node:util').promisify(require('node:zlib').gzip)(payload,{level:4});
      return res.status(200).set('Content-Encoding','gzip').type('json').send(compressed);
    }
    return res.status(200).type('json').send(payload);
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

    return await respondWithDuel(req,res,next,execution => gameService.runAutomatedBotDuel({
      userId,
      userName,
      bot1Id,
      bot2Level,
      bot2Id,
      boardSize: Number(boardSize),
      difficulty,
      ...execution,
    }));
  } catch (err) {
    next(err);
  }
}

async function runPvPDuel(req, res, next) {
  try {
    if (req.body.bot1Id || req.body.bot2Id) return res.status(400).json({success:false,
      message:'Không chọn bot hộ người chơi. Trận PvP dùng bot chính của mỗi người.'});
    return await respondWithDuel(req,res,next,execution => gameService.runPvPDuel({
      userId:req.user.id,userName:req.user.username,opponentUserId:req.body.opponentUserId,
      boardSize:Number(req.body.boardSize || 9),
      ...execution,
    }));
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
