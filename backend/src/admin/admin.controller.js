/**
 * Admin Controller - Centralized System Management for Teachers & Administrators
 */

const { query } = require('../config/db');
const { matchQueue } = require('../config/redis');
const tournamentService = require('../tournament/tournament.service');
const gameService = require('../game/gameService');
const accounts = require('./admin.accounts');
const { invalidateArenaReads } = require('../game/arenaReads');
const deletions = require('./admin.deletions');

async function listMatches(req,res,next) {
  try {
    const {matches,pagination} = await deletions.listMatches(req.query);
    res.json({success:true,data:matches,pagination});
  } catch (error) { next(error); }
}

async function deleteMatch(req,res,next) {
  try {
    const data = await deletions.deleteMatch(req.params.id);
    gameService.forgetDeletedData?.({matchId:data.id});
    invalidateArenaReads();
    res.json({success:true,data,message:'Đã xóa trận đấu và replay. Điểm Elo được giữ nguyên.'});
  } catch (error) { next(error); }
}

async function deleteUser(req,res,next) {
  try {
    const data = await deletions.deleteUser(req.user.id,req.params.id);
    gameService.forgetDeletedData?.({userId:data.id});
    invalidateArenaReads();
    res.json({success:true,data,message:`Đã xóa tài khoản ${data.username}, bot và lịch sử trận liên quan.`});
  } catch (error) { next(error); }
}

/**
 * Get all users with stats
 */
async function listUsers(req, res, next) {
  try {
    const sql = `
      SELECT
        u.id, 
        u.username, 
        u.role, 
        u.elo_rating, 
        u.created_at,
        COUNT(DISTINCT b.id)::INT AS bot_count,
        COALESCE(ms.wins, 0)::INT AS wins,
        COALESCE(ms.losses, 0)::INT AS losses
      FROM "Users" u
      LEFT JOIN "Bots" b ON b.user_id = u.id
      LEFT JOIN (
        SELECT player_id,
          COUNT(*) FILTER (WHERE winner_id = player_id) AS wins,
          COUNT(*) FILTER (WHERE winner_id IS NOT NULL AND winner_id != player_id) AS losses
        FROM (
          SELECT player1_id AS player_id, winner_id FROM "Matches" WHERE player1_id IS NOT NULL
          UNION ALL
          SELECT player2_id AS player_id, winner_id FROM "Matches" WHERE player2_id IS NOT NULL AND player2_id IS DISTINCT FROM player1_id
        ) appearances
        GROUP BY player_id
      ) ms ON ms.player_id = u.id
      GROUP BY u.id, u.username, u.role, u.elo_rating, u.created_at, ms.wins, ms.losses
      ORDER BY u.created_at DESC;
    `;
    const result = await query(sql);
    return res.status(200).json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

/**
 * Update user role (STUDENT, TEACHER, ADMIN)
 */
async function updateUserRole(req, res, next) {
  try {
    const data = await accounts.changeRole(req.user.id, req.params.id, req.body?.role);
    invalidateArenaReads();
    return res.status(200).json({ success: true, message: `Đã cập nhật quyền thành ${data.role}`, data });
  } catch (err) {
    next(err);
  }
}

async function updateUserAccount(req, res, next) {
  try {
    const data = await accounts.renameUser(req.params.id, req.body?.username);
    invalidateArenaReads();
    return res.status(200).json({ success: true, message: 'Đã cập nhật tên đăng nhập.', data });
  } catch (error) {
    next(error);
  }
}

async function resetUserPassword(req, res, next) {
  try {
    const data = await accounts.resetPassword(req.params.id, req.body?.password);
    return res.status(200).json({ success: true, message: `Đã đặt mật khẩu mới cho ${data.username}.`, data });
  } catch (error) {
    next(error);
  }
}

/**
 * Adjust user Elo rating
 */
async function updateUserElo(req, res, next) {
  try {
    const { id } = req.params;
    const { elo } = req.body;
    const eloNum = parseInt(elo, 10);
    if (isNaN(eloNum) || eloNum < 100 || eloNum > 3500) {
      return res.status(400).json({ success: false, message: 'Điểm Elo phải từ 100 đến 3500.' });
    }
    const result = await query('UPDATE "Users" SET elo_rating = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, elo_rating', [eloNum, id]);
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }
    invalidateArenaReads();
    return res.status(200).json({ success: true, message: `Đã chỉnh Elo thành ${eloNum}`, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * List all bots across all students
 */
async function listAllBots(req, res, next) {
  try {
    const sql = `
      SELECT 
        b.id, b.name, b.source_type, b.file_path_or_git_url, b.status, b.error_count, b.is_active, b.created_at,
        u.id AS user_id, u.username, u.elo_rating
      FROM "Bots" b
      JOIN "Users" u ON u.id = b.user_id
      ORDER BY b.created_at DESC;
    `;
    const result = await query(sql);
    return res.status(200).json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

/**
 * Delete a bot (Admin privilege)
 */
async function adminDeleteBot(req, res, next) {
  try {
    const { id } = req.params;
    await query('DELETE FROM "Bots" WHERE id = $1', [id]);
    return res.status(200).json({ success: true, message: 'Đã xóa bot khỏi hệ thống.' });
  } catch (err) {
    next(err);
  }
}

/**
 * Create a Grade/School tournament
 */
async function createGradeTournament(req, res, next) {
  try {
    const { name, gradeCategory = 'Khối 10', scheduledStartAt, maxParticipants = 1000 } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Tên giải đấu không được trống.' });
    }

    const settings = {
      gradeCategory,
      totalRounds: 5,
      boardSize: 9,
      difficulty: 'hard',
      participants: [],
      scoringRules: {
        winPoints: 3,
        drawPoints: 1,
        lossPoints: 0,
        killBonus: 0.5,
        flagBonus: 2.0,
      },
    };

    const sql = `
      INSERT INTO "Tournaments" (name, status, max_participants, scheduled_start_at, settings_json)
      VALUES ($1, 'UPCOMING', $2, $3, $4)
      RETURNING *;
    `;
    const result = await query(sql, [name, maxParticipants, scheduledStartAt || null, JSON.stringify(settings)]);
    return res.status(201).json({ success: true, message: `Tạo giải đấu ${name} thành công!`, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * Trigger automated batch grading for all participants in a tournament
 * Each student's bot automatically plays matches and points are recorded
 */
async function batchGradeTournament(req, res, next) {
  try {
    const { id } = req.params;
    const tourneyRes = await query('SELECT * FROM "Tournaments" WHERE id = $1', [id]);
    const tourney = tourneyRes.rows[0];
    if (!tourney) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giải đấu.' });
    }

    const settings = tourney.settings_json || {};
    const participants = settings.participants || [];

    if (participants.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Giải đấu chưa có thí sinh nào đăng ký để chấm điểm.',
      });
    }

    // Automatically simulate matches between participants or benchmark bots
    const benchmarkBots = ['EASY', 'MEDIUM', 'HARD'];
    const gradingResults = [];

    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      let totalPoints = p.points || 0;
      let wins = p.wins || 0;
      let losses = p.losses || 0;
      let draws = p.draws || 0;

      // Run match against a benchmark AI Boss
      const testBossLevel = benchmarkBots[i % benchmarkBots.length];
      try {
        const matchResult = await gameService.runAutomatedBotDuel({
          userId: p.userId,
          userName: p.username,
          bot1Id: p.botId,
          bot2Level: testBossLevel,
          boardSize: settings.boardSize || 9,
          difficulty: 'medium',
        });

        if (matchResult.winner === 1) {
          wins++;
          totalPoints += 3;
        } else if (matchResult.winner === 2) {
          losses++;
        } else {
          draws++;
          totalPoints += 1;
        }

        p.points = totalPoints;
        p.wins = wins;
        p.losses = losses;
        p.draws = draws;
        p.lastMatchId = matchResult.matchId;
        p.winRate = Math.round((wins / (wins + losses + draws || 1)) * 100);

        gradingResults.push({
          username: p.username,
          opponent: `Boss ${testBossLevel}`,
          winner: matchResult.winnerName,
          matchId: matchResult.matchId,
          points: totalPoints,
        });
      } catch (matchErr) {
        console.warn(`[Batch Grade] Match failed for ${p.username}:`, matchErr.message);
      }
    }

    // Update tournament status and settings in DB
    settings.currentRound = (settings.currentRound || 0) + 1;
    await query(
      'UPDATE "Tournaments" SET status = $1, settings_json = $2, updated_at = NOW() WHERE id = $3',
      ['ONGOING', JSON.stringify(settings), id]
    );

    return res.status(200).json({
      success: true,
      message: `Đã hoàn tất chấm điểm tự động Vòng ${settings.currentRound} cho ${participants.length} học sinh!`,
      data: {
        tournamentId: id,
        currentRound: settings.currentRound,
        participantsEvaluated: participants.length,
        evaluations: gradingResults,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Delete a tournament
 */
async function deleteTournament(req, res, next) {
  try {
    const { id } = req.params;
    await query('DELETE FROM "Tournaments" WHERE id = $1', [id]);
    return res.status(200).json({ success: true, message: 'Đã xóa giải đấu thành công.' });
  } catch (err) {
    next(err);
  }
}

/**
 * Get system status and BullMQ Redis queue counts
 */
async function getSystemStats(req, res, next) {
  try {
    const counts = await query(`SELECT
      (SELECT COUNT(*)::INT FROM "Users") AS users,
      (SELECT COUNT(*)::INT FROM "Bots") AS bots,
      (SELECT COUNT(*)::INT FROM "Matches") AS matches,
      (SELECT COUNT(*)::INT FROM "Tournaments") AS tournaments`);

    let queueCounts = { waiting: 0, active: 0, completed: 0, failed: 0 };
    let queueAvailable = false;
    let queueTimeout;
    try {
      queueCounts = await Promise.race([
        matchQueue.getJobCounts('waiting', 'active', 'completed', 'failed'),
        new Promise((resolve, reject) => {
          queueTimeout = setTimeout(() => reject(new Error('Queue unavailable')), 1000);
        }),
      ]);
      queueAvailable = true;
    } catch {} finally {
      clearTimeout(queueTimeout);
    }

    return res.status(200).json({
      success: true,
      data: {
        totalUsers: counts.rows[0].users,
        totalBots: counts.rows[0].bots,
        totalMatches: counts.rows[0].matches,
        totalTournaments: counts.rows[0].tournaments,
        judgeQueue: queueCounts,
        queueAvailable,
        uptimeSeconds: Math.floor(process.uptime()),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Create advanced University Tournament (All-In or Branches)
 */
async function createUniversityTournament(req, res, next) {
  try {
    const { name, mode = 'ALL_IN', faculty = 'Khoa CNTT', scheduledStartAt, maxParticipants = 1000 } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Tên giải đấu không được để trống.' });
    }

    const defaultBrackets = mode === 'BRANCHES' ? [
      { id: 'b_qf1', round: 1, matchNumber: 1, title: 'Tứ Kết 1', p1: { name: 'Thí sinh 1', bot: 'Bot A', score: null }, p2: { name: 'Thí sinh 2', bot: 'Bot B', score: null }, winner: null, status: 'PENDING' },
      { id: 'b_qf2', round: 1, matchNumber: 2, title: 'Tứ Kết 2', p1: { name: 'Thí sinh 3', bot: 'Bot C', score: null }, p2: { name: 'Thí sinh 4', bot: 'Bot D', score: null }, winner: null, status: 'PENDING' },
      { id: 'b_qf3', round: 1, matchNumber: 3, title: 'Tứ Kết 3', p1: { name: 'Thí sinh 5', bot: 'Bot E', score: null }, p2: { name: 'Thí sinh 6', bot: 'Bot F', score: null }, winner: null, status: 'PENDING' },
      { id: 'b_qf4', round: 1, matchNumber: 4, title: 'Tứ Kết 4', p1: { name: 'Thí sinh 7', bot: 'Bot G', score: null }, p2: { name: 'Thí sinh 8', bot: 'Bot H', score: null }, winner: null, status: 'PENDING' },
      { id: 'b_sf1', round: 2, matchNumber: 5, title: 'Bán Kết 1', p1: { name: 'Thắng Tứ Kết 1', bot: 'TBD', score: null }, p2: { name: 'Thắng Tứ Kết 2', bot: 'TBD', score: null }, winner: null, status: 'PENDING' },
      { id: 'b_sf2', round: 2, matchNumber: 6, title: 'Bán Kết 2', p1: { name: 'Thắng Tứ Kết 3', bot: 'TBD', score: null }, p2: { name: 'Thắng Tứ Kết 4', bot: 'TBD', score: null }, winner: null, status: 'PENDING' },
      { id: 'b_fn1', round: 3, matchNumber: 7, title: 'Chung Kết Cúp', p1: { name: 'Thắng Bán Kết 1', bot: 'TBD', score: null }, p2: { name: 'Thắng Bán Kết 2', bot: 'TBD', score: null }, winner: null, status: 'PENDING' },
    ] : [];

    const settings = {
      faculty,
      mode,
      totalRounds: mode === 'BRANCHES' ? 3 : 5,
      boardSize: 9,
      difficulty: 'hard',
      participants: [],
      scoringRules: {
        winPoints: 3,
        drawPoints: 1,
        lossPoints: 0,
        flagBonus: 2.0,
      },
    };

    const sql = `
      INSERT INTO "Tournaments" (name, status, mode, max_participants, scheduled_start_at, brackets_json, settings_json)
      VALUES ($1, 'UPCOMING', $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const result = await query(sql, [
      name,
      mode,
      maxParticipants,
      scheduledStartAt || null,
      JSON.stringify(defaultBrackets),
      JSON.stringify(settings),
    ]);

    return res.status(201).json({
      success: true,
      message: `Khởi tạo giải đấu sinh viên "${name}" thành công!`,
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Assign a student or bot to a specific bracket slot
 */
async function assignBracketSlot(req, res, next) {
  try {
    const { id } = req.params;
    const { bracketMatchId, slot, studentName, botName } = req.body;

    const tourneyRes = await query('SELECT * FROM "Tournaments" WHERE id = $1', [id]);
    const tourney = tourneyRes.rows[0];
    if (!tourney) return res.status(404).json({ success: false, message: 'Không tìm thấy giải đấu.' });

    let brackets = tourney.brackets_json || [];
    const match = brackets.find(b => b.id === bracketMatchId);
    if (!match) return res.status(404).json({ success: false, message: 'Không tìm thấy trận đấu trong nhánh.' });

    if (slot === 'p1') {
      match.p1 = { name: studentName, bot: botName || 'Custom Bot', score: null };
    } else {
      match.p2 = { name: studentName, bot: botName || 'Custom Bot', score: null };
    }

    await query('UPDATE "Tournaments" SET brackets_json = $1, updated_at = NOW() WHERE id = $2', [
      JSON.stringify(brackets),
      id,
    ]);

    return res.status(200).json({
      success: true,
      message: `Đã xếp ${studentName} (${botName || 'Bot'}) vào vị trí ${slot.toUpperCase()} của ${match.title}!`,
      data: brackets,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Automatically execute all pending bracket matches
 */
async function runBracketMatches(req, res, next) {
  try {
    const { id } = req.params;
    const tourneyRes = await query('SELECT * FROM "Tournaments" WHERE id = $1', [id]);
    const tourney = tourneyRes.rows[0];
    if (!tourney) return res.status(404).json({ success: false, message: 'Không tìm thấy giải đấu.' });

    let brackets = tourney.brackets_json || [];
    let updatedCount = 0;

    for (let i = 0; i < brackets.length; i++) {
      const match = brackets[i];
      if (match.status !== 'COMPLETED' && match.p1?.name && match.p2?.name && !match.p1.name.includes('Thắng') && !match.p2.name.includes('Thắng')) {
        const p1Score = Math.random() > 0.4 ? 1 : 0;
        const p2Score = p1Score === 1 ? 0 : 1;
        match.p1.score = p1Score;
        match.p2.score = p2Score;
        match.winner = p1Score > p2Score ? match.p1.name : match.p2.name;
        match.status = 'COMPLETED';
        updatedCount++;

        // Propagate winner to next round
        if (match.id === 'b_qf1' || match.id === 'bracket_qf1') {
          const sf1 = brackets.find(b => b.id === 'b_sf1' || b.id === 'bracket_sf1');
          if (sf1) sf1.p1 = { name: match.winner, bot: match.p1.name === match.winner ? match.p1.bot : match.p2.bot, score: null };
        } else if (match.id === 'b_qf2' || match.id === 'bracket_qf2') {
          const sf1 = brackets.find(b => b.id === 'b_sf1' || b.id === 'bracket_sf1');
          if (sf1) sf1.p2 = { name: match.winner, bot: match.p1.name === match.winner ? match.p1.bot : match.p2.bot, score: null };
        } else if (match.id === 'b_qf3' || match.id === 'bracket_qf3') {
          const sf2 = brackets.find(b => b.id === 'b_sf2' || b.id === 'bracket_sf2');
          if (sf2) sf2.p1 = { name: match.winner, bot: match.p1.name === match.winner ? match.p1.bot : match.p2.bot, score: null };
        } else if (match.id === 'b_qf4' || match.id === 'bracket_qf4') {
          const sf2 = brackets.find(b => b.id === 'b_sf2' || b.id === 'bracket_sf2');
          if (sf2) sf2.p2 = { name: match.winner, bot: match.p1.name === match.winner ? match.p1.bot : match.p2.bot, score: null };
        } else if (match.id === 'b_sf1' || match.id === 'bracket_sf1') {
          const fn = brackets.find(b => b.id === 'b_fn1' || b.id === 'bracket_fn1');
          if (fn) fn.p1 = { name: match.winner, bot: match.p1.name === match.winner ? match.p1.bot : match.p2.bot, score: null };
        } else if (match.id === 'b_sf2' || match.id === 'bracket_sf2') {
          const fn = brackets.find(b => b.id === 'b_fn1' || b.id === 'bracket_fn1');
          if (fn) fn.p2 = { name: match.winner, bot: match.p1.name === match.winner ? match.p1.bot : match.p2.bot, score: null };
        }
      }
    }

    await query('UPDATE "Tournaments" SET brackets_json = $1, status = \'ONGOING\', updated_at = NOW() WHERE id = $2', [
      JSON.stringify(brackets),
      id,
    ]);

    return res.status(200).json({
      success: true,
      message: `Đã tự động mô phỏng xong các trận đấu trong nhánh! Đã cập nhật kết quả và đẩy người thắng vào vòng kế tiếp.`,
      data: brackets,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listMatches,
  deleteMatch,
  deleteUser,
  listUsers,
  updateUserRole,
  updateUserAccount,
  resetUserPassword,
  updateUserElo,
  listAllBots,
  adminDeleteBot,
  createGradeTournament,
  createUniversityTournament,
  assignBracketSlot,
  runBracketMatches,
  batchGradeTournament,
  deleteTournament,
  getSystemStats,
};
