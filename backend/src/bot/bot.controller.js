/**
 * Bot Controller - HTTP Handlers for Bot Submissions
 */

const fs = require('fs');
const path = require('path');
const botService = require('./bot.service');

async function uploadBot(req, res, next) {
  try {
    const { name } = req.body;
    const userId = req.user.id;
    const file = req.file;

    const bot = await botService.saveUploadedBot({
      userId,
      botName: name,
      file,
    });

    return res.status(201).json({
      success: true,
      message: `Nộp bot thành công! Đã chạy thử nước đi cho cả hai phe. ${bot.is_active ? 'Bot này đang là bot chính của bạn.' : 'Bấm Chọn Làm Bot Chính để dùng bot vừa nộp khi đấu PvP.'}`,
      data: bot,
    });
  } catch (err) {
    next(err);
  }
}

async function submitGitBot(req, res, next) {
  try {
    const { name, gitUrl } = req.body;
    const userId = req.user.id;

    if (!gitUrl) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp gitUrl của repository Bot.',
      });
    }

    const bot = await botService.saveGitBot({
      userId,
      botName: name,
      gitUrl,
    });

    return res.status(201).json({
      success: true,
      message: 'Git clone kho lưu trữ Bot thành công!',
      data: bot,
    });
  } catch (err) {
    next(err);
  }
}

async function listMyBots(req, res, next) {
  try {
    const userId = req.user.id;
    const bots = await botService.getUserBots(userId);
    return res.status(200).json({
      success: true,
      data: bots,
    });
  } catch (err) {
    next(err);
  }
}

async function getBot(req, res, next) {
  try {
    const { id } = req.params;
    const bot = await botService.getBotById(id, req.user.id);
    if (!bot) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy Bot.',
      });
    }
    return res.status(200).json({
      success: true,
      data: bot,
    });
  } catch (err) {
    next(err);
  }
}

async function activateBot(req, res, next) {
  try {
    const { id } = req.params;
    const bot = await botService.activateBot(id, req.user.id);
    return res.status(200).json({
      success: true,
      message: `Đã kích hoạt Bot "${bot.name}" làm chiến binh chính thức!`,
      data: bot,
    });
  } catch (err) {
    next(err);
  }
}

async function removeBot(req, res, next) {
  try {
    const { id } = req.params;
    const result = await botService.deleteBot(id, req.user.id);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function createBot(req, res, next) {
  try {
    const { name, code } = req.body;
    const userId = req.user.id;

    const bot = await botService.createCodeBot({
      userId,
      botName: name,
      code,
    });

    return res.status(201).json({
      success: true,
      message: 'Tạo bot thành công! Đã kiểm tra cú pháp và chạy thử nước đi cho cả hai phe.',
      data: bot,
    });
  } catch (err) {
    next(err);
  }
}

async function changeTactic(req, res, next) {
  return res.status(400).json({success:false,
    message:'Bot chạy nguyên mã nguồn bạn nộp. Để đổi thuật toán, hãy sửa mã nguồn và nộp bot mới.'});
}

async function listPlayers(req, res, next) {
  try { return res.json({success:true,data:await botService.getPlayers()}); }
  catch (error) { next(error); }
}

async function getTemplates(req, res, next) {
  try {
    const sampleBotsDir = path.join(__dirname, '../../../sample-bots');
    const templates = [
      {
        id: 'flag_rusher_strategy',
        name: '🚩 Cướp Cờ Thần Tốc (A* Flag Rusher)',
        algorithm: 'A* Pathfinding & Heuristic Cướp Căn Cứ Cờ (0,0) & (8,8)',
        description: 'Chiến thuật tính toán lộ trình ngắn nhất đâm thẳng vào Căn cứ Cờ đối phương để thắng chớp nhoáng, ăn bình Tăng Tốc 2 bước và né quân khắc chế.',
        filename: 'flag_rusher_strategy_bot.py',
      },
      {
        id: 'minimax_alphabeta',
        name: '⚔️ Minimax Alpha-Beta Pruning Bot',
        algorithm: 'Minimax & Alpha-Beta Search (Độ sâu 2-3 lượt)',
        description: 'Thuật toán tìm kiếm theo chiều sâu dự đoán trước các nước đi của đối thủ, kết hợp tỉa nhánh Alpha-Beta và tối ưu hóa thế trận.',
        filename: 'minimax_alphabeta_bot.py',
      },
      {
        id: 'astar_flag_rusher',
        name: '🏃 A* Flag Rusher Bot',
        algorithm: 'A* Heuristic Graph Pathfinding (Lao cờ chiếm cứ điểm)',
        description: 'Thuật toán A* với hàm f(n) = g(n) + h(n), chủ động lao thẳng về hàng cuối của đối thủ để chiếm cờ, tự động né quân khắc chế và ăn buff.',
        filename: 'astar_flag_rusher_bot.py',
      },
      {
        id: 'heuristic_starter',
        name: '💡 Heuristic Starter Bot',
        algorithm: 'Chiến thuật Tham lam & Đánh giá Ma trận Tương quan',
        description: 'Bản mẫu cơ bản tính điểm chiến thuật theo ma trận Oẳn Tù Tì, ăn bình buff và tiến công an toàn.',
        filename: 'heuristic.py',
      },
    ];

    const result = templates.map((t) => {
      const filePath = path.join(sampleBotsDir, t.filename);
      let code = '';
      if (fs.existsSync(filePath)) {
        code = fs.readFileSync(filePath, 'utf-8');
      }
      return { ...t, code };
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function listCommunityBots(req, res, next) {
  try {
    const bots = await botService.getCommunityBots();
    return res.status(200).json({
      success: true,
      data: bots,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadBot,
  submitGitBot,
  createBot,
  changeTactic,
  listMyBots,
  getBot,
  removeBot,
  activateBot,
  getTemplates,
  listCommunityBots,
  listPlayers,
};
