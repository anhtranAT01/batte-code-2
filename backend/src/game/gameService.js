/**
 * Game Service - Orchestrates Practice Matches, Engine Updates, and Replay Persistence
 */

const { GameEngine } = require('./gameEngine');
const { getPracticeBot } = require('./practiceBots');
const { generateMap } = require('./mapGenerator');
const { query } = require('../config/db');
const crypto = require('crypto');

// In-memory active game sessions
const activeMatches = new Map();

/**
 * Create a new practice match against System Bot
 */
async function createPracticeMatch({
  userId = null,
  userName = 'Student Player',
  boardSize = 8,
  difficulty = 'medium',
  botLevel = 'MEDIUM',
}) {
  const matchId = `practice_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const validSize = boardSize === 9 ? 9 : 8;

  const game = new GameEngine({
    matchId,
    size: validSize,
    difficulty,
    maxTurns: 150,
  });

  const bot = getPracticeBot(botLevel, 2);

  activeMatches.set(matchId, {
    matchId,
    userId,
    userName,
    botLevel,
    game,
    bot,
    createdAt: Date.now(),
  });

  return {
    matchId,
    size: validSize,
    difficulty,
    botLevel,
    turnCount: game.turnCount,
    currentTurnPlayer: game.currentTurnPlayer,
    board: game.getBoardSnapshot(),
    validMoves: game.getValidMovesForPlayer(1),
    mapConfig: game.mapConfig,
  };
}

/**
 * Execute player's turn, then automatically invoke Bot's counter-turn
 */
async function submitPlayerMove({ matchId, move, executionTimeMs = 120 }) {
  const session = activeMatches.get(matchId);
  if (!session) {
    const error = new Error(`Không tìm thấy trận đấu với ID: ${matchId}`);
    error.statusCode = 404;
    throw error;
  }

  const { game, bot } = session;

  if (game.isGameOver) {
    return {
      isGameOver: true,
      winner: game.winner,
      winReason: game.winReason,
      board: game.getBoardSnapshot(),
      replay: game.getReplayJson(),
    };
  }

  // 1. Execute Player 1 Move
  const playerResult = game.executeMove(1, move, executionTimeMs);
  if (!playerResult.success) {
    return {
      success: false,
      error: playerResult.error,
      isGameOver: game.isGameOver,
      winner: game.winner,
      winReason: game.winReason,
      board: game.getBoardSnapshot(),
    };
  }

  let botStep = null;

  // 2. If game is still ongoing, execute Bot Turn (Player 2)
  if (!game.isGameOver && game.currentTurnPlayer === 2) {
    const botDecision = bot.chooseMove(game);

    if (botDecision.move) {
      const botResult = game.executeMove(2, botDecision.move, botDecision.calculationTimeMs);
      botStep = botResult.step;
    } else {
      // Bot has no legal moves -> Forfeit to Player 1
      game.isGameOver = true;
      game.winner = 1;
      game.winReason = 'CHECKMATE';
    }
  }

  // 3. If game completed, persist replay to PostgreSQL if DB is available
  if (game.isGameOver) {
    try {
      const replayJson = game.getReplayJson();
      if (session.userId) {
        await query(
          `INSERT INTO "Matches" (id, player1_id, player2_id, map_id, winner_id, win_reason, duration_ms, replay_json)
           VALUES ($1, $2, $2, (SELECT id FROM "Maps" LIMIT 1), $3, $4, $5, $6)
           ON CONFLICT (id) DO NOTHING;`,
          [
            matchId,
            session.userId,
            game.winner === 1 ? session.userId : null,
            game.winReason,
            Date.now() - session.createdAt,
            JSON.stringify(replayJson),
          ]
        );
      }
    } catch (dbErr) {
      console.warn('[GameService DB Warning]: Could not persist match to database:', dbErr.message);
    }
  }

  return {
    success: true,
    playerStep: playerResult.step,
    botStep,
    isGameOver: game.isGameOver,
    winner: game.winner,
    winReason: game.winReason,
    board: game.getBoardSnapshot(),
    validMoves: game.isGameOver ? [] : game.getValidMovesForPlayer(1),
    replay: game.isGameOver ? game.getReplayJson() : null,
  };
}

/**
 * Retrieve replay for playback from RAM or PostgreSQL Database
 */
async function getReplay(matchId) {
  // 1. Check in-memory active match sessions
  const session = activeMatches.get(matchId);
  if (session) {
    return session.game.getReplayJson();
  }

  // 2. Query historical matches from PostgreSQL database
  try {
    const res = await query(
      `SELECT m.id, m.winner_id, m.win_reason, m.duration_ms, m.replay_json,
              u1.username AS p1_username, u2.username AS p2_username,
              b1.name AS p1_bot_name, b2.name AS p2_bot_name,
              uw.username AS winner_username
       FROM "Matches" m
       LEFT JOIN "Users" u1 ON u1.id = m.player1_id
       LEFT JOIN "Users" u2 ON u2.id = m.player2_id
       LEFT JOIN "Bots" b1 ON b1.id = m.player1_bot_id
       LEFT JOIN "Bots" b2 ON b2.id = m.player2_bot_id
       LEFT JOIN "Users" uw ON uw.id = m.winner_id
       WHERE m.id::text = $1 OR m.id::text LIKE $2`,
      [matchId, `${matchId}%`]
    );

    if (res.rows.length > 0) {
      const match = res.rows[0];
      let replay = match.replay_json;
      if (typeof replay === 'string') {
        try {
          replay = JSON.parse(replay);
        } catch {}
      }

      if (replay && replay.steps) {
        return {
          ...replay,
          matchId: match.id,
          p1Name: match.p1_username || 'Phe Xanh (P1)',
          p2Name: match.p2_username || 'Phe Đỏ (P2)',
          p1BotName: match.p1_bot_name,
          p2BotName: match.p2_bot_name,
          winnerName: match.winner_username,
          winReason: match.win_reason,
          durationMs: match.duration_ms,
        };
      }

      if (Array.isArray(replay)) {
        return {
          matchId: match.id,
          steps: replay,
          initialBoard: replay[0]?.boardSnapshot || [],
          p1Name: match.p1_username || 'Phe Xanh (P1)',
          p2Name: match.p2_username || 'Phe Đỏ (P2)',
          p1BotName: match.p1_bot_name,
          p2BotName: match.p2_bot_name,
          winnerName: match.winner_username,
          winReason: match.win_reason,
          durationMs: match.duration_ms,
        };
      }

      return replay;
    }
  } catch (err) {
    console.warn('[GetReplay DB query error]:', err.message);
  }

  return null;
}

/**
 * Generate preview map layout
 */
function previewMap(size = 8, difficulty = 'medium') {
  return generateMap({ size: Number(size), difficulty });
}

/**
 * Get recent matches for FFA arena match list
 */
async function getRecentMatches(limit = 10) {
  const sql = `
    SELECT m.id, m.duration_ms, m.winner_id, m.win_reason, m.p1_elo_change, m.p2_elo_change,
           m.has_infinite_loop_error, m.created_at,
           CASE 
             WHEN m.replay_json IS NULL THEN 0
             WHEN jsonb_typeof(m.replay_json) = 'array' THEN jsonb_array_length(m.replay_json)
             WHEN jsonb_typeof(m.replay_json->'steps') = 'array' THEN jsonb_array_length(m.replay_json->'steps')
             WHEN (m.replay_json->>'totalTurns') IS NOT NULL THEN (m.replay_json->>'totalTurns')::int
             ELSE 0
           END AS total_turns,
           u1.username AS p1_username, u1.elo_rating AS p1_elo,
           u2.username AS p2_username, u2.elo_rating AS p2_elo,
           b1.name AS p1_bot_name, b2.name AS p2_bot_name,
           uw.username AS winner_username
    FROM "Matches" m
    LEFT JOIN "Users" u1 ON u1.id = m.player1_id
    LEFT JOIN "Users" u2 ON u2.id = m.player2_id
    LEFT JOIN "Users" uw ON uw.id = m.winner_id
    LEFT JOIN "Bots" b1 ON b1.id = m.player1_bot_id
    LEFT JOIN "Bots" b2 ON b2.id = m.player2_bot_id
    ORDER BY m.created_at DESC
    LIMIT $1;
  `;
  try {
    const res = await query(sql, [limit]);
    return res.rows;
  } catch (err) {
    console.error('[getRecentMatches DB Error]:', err.message);
    return [];
  }
}


/**
 * Get Leaderboard with Elo, W/L/D, and active bot
 */
async function getLeaderboard(limit = 50) {
  const sql = `
    SELECT 
      u.id, 
      u.username, 
      u.role, 
      u.elo_rating,
      b.id AS active_bot_id,
      b.name AS active_bot_name,
      COALESCE(SUM(CASE WHEN m.winner_id = u.id THEN 1 ELSE 0 END), 0)::INT AS wins,
      COALESCE(SUM(CASE WHEN m.winner_id IS NOT NULL AND m.winner_id != u.id AND (m.player1_id = u.id OR m.player2_id = u.id) THEN 1 ELSE 0 END), 0)::INT AS losses,
      COALESCE(SUM(CASE WHEN m.winner_id IS NULL AND (m.player1_id = u.id OR m.player2_id = u.id) THEN 1 ELSE 0 END), 0)::INT AS draws
    FROM "Users" u
    LEFT JOIN "Bots" b ON b.user_id = u.id AND b.is_active = true
    LEFT JOIN "Matches" m ON (m.player1_id = u.id OR m.player2_id = u.id)
    GROUP BY u.id, u.username, u.role, u.elo_rating, b.id, b.name
    ORDER BY u.elo_rating DESC, wins DESC
    LIMIT $1;
  `;
  try {
    const res = await query(sql, [limit]);
    return res.rows;
  } catch (err) {
    console.warn('[Leaderboard query error]:', err.message);
    return [];
  }
}

const { resolveBotPath } = require('../bot/botStorage');
const { getTemplateBot, playBotTurn } = require('./botDuel');

async function runPvPDuel({userId,userName,opponentUserId,boardSize = 9}) {
  const fail = (message,statusCode = 400) => { const error = new Error(message); error.statusCode = statusCode; throw error; };
  if (!userId) fail('Bạn cần đăng nhập để thi đấu PvP.',401);
  if (!opponentUserId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(opponentUserId)) {
    fail('Vui lòng chọn người chơi đối thủ.');
  }
  if (opponentUserId === userId) fail('Hãy chọn một người chơi khác.');
  const {rows} = await query(`
    SELECT DISTINCT ON (user_id) * FROM "Bots"
    WHERE user_id IN ($1,$2) AND is_active = true AND status = 'active'
    ORDER BY user_id, updated_at DESC, id
  `,[userId,opponentUserId]);
  const own = rows.find(bot => bot.user_id === userId);
  const opponent = rows.find(bot => bot.user_id === opponentUserId);
  if (!own) fail('Bạn chưa chọn bot chính. Vào Kho bot, chọn bot bạn đã nộp làm bot chính.',422);
  if (!opponent) fail('Đối thủ chưa chọn bot chính. Hãy chọn người khác hoặc chờ họ kích hoạt bot.',422);
  // Snapshot each owner's choice at match start. No bot IDs come from the challenger.
  resolveBotPath(own);
  resolveBotPath(opponent);
  return runAutomatedBotDuel({userId,userName,bot1Id:own.id,bot2Id:opponent.id,
    boardSize,difficulty:'medium'});
}

/**
 * Execute a complete automated match between Bot 1 and Bot 2 (AI Boss or Python Bot)
 */
async function runAutomatedBotDuel({
  userId = null,
  userName = 'Kỳ Thủ',
  bot1Id = null,
  bot2Level = 'MEDIUM',
  bot2Id = null,
  boardSize = 9,
  difficulty = 'medium',
}) {
  const matchId = crypto.randomUUID();
  const validSize = boardSize === 8 ? 8 : 9;

  // Built-in templates and bosses share the same strategy implementations.
  const template1 = getTemplateBot(!bot1Id || bot1Id === 'MANUAL' ? 'template_heuristic' : bot1Id, 1);
  let bot1ScriptPath = null;
  let bot1Name = template1?.name;
  let bot1RecordId = null;

  if (!template1) {
    const bRes = await query('SELECT * FROM "Bots" WHERE id = $1 AND user_id = $2', [bot1Id,userId]);
    if (bRes.rows.length > 0) {
      const b = bRes.rows[0];
      bot1ScriptPath = resolveBotPath(b);
      bot1Name = b.name;
      bot1RecordId = b.id;
    }
    if (!bot1ScriptPath) throw new Error('Không tìm thấy file bot đã chọn cho P1.');
  }

  // Resolve Bot 2 (System Boss or Student Bot)
  let bot2ScriptPath = null;
  let systemBot2 = null;
  let bot2Name = `Boss AI (${bot2Level})`;
  let bot2RecordId = null;
  let player2UserId = null;
  let player2Username = null;

  if (bot2Id) {
    const bRes = await query(`
        SELECT b.*, u.id AS owner_id, u.username AS owner_name 
        FROM "Bots" b 
        JOIN "Users" u ON u.id = b.user_id 
        WHERE b.id = $1
      `, [bot2Id]);
    if (bRes.rows.length > 0) {
      const b = bRes.rows[0];
      bot2ScriptPath = resolveBotPath(b);
      bot2Name = b.name;
      bot2RecordId = b.id;
      player2UserId = b.owner_id;
      player2Username = b.owner_name;
    }
    if (!bot2ScriptPath) throw new Error('Không tìm thấy file bot đã chọn cho P2.');
  }

  if (!bot2ScriptPath) {
    systemBot2 = getPracticeBot(bot2Level, 2);
  }

  // Initialize Game Engine
  const game = new GameEngine({
    matchId,
    size: validSize,
    difficulty,
    maxTurns: 150,
  });
  game.allowFallback = false;

  const startTime = Date.now();
  const participants = {
    1: { name: bot1Name, bot: template1?.bot, scriptPath: bot1ScriptPath },
    2: { name: bot2Name, bot: systemBot2, scriptPath: bot2ScriptPath },
  };
  while (!game.isGameOver && game.turnCount < game.maxTurns) {
    await playBotTurn(game, participants[game.currentTurnPlayer]);
  }
  const durationMs = Date.now() - startTime;
  const replayJson = game.getReplayJson();

  // Persist match in database if user is logged in
  try {
    const winnerId = game.winner === 1 ? userId : (game.winner === 2 && player2UserId ? player2UserId : null);
    await query(
      `INSERT INTO "Matches" (id, player1_id, player2_id, player1_bot_id, player2_bot_id, map_id, winner_id, win_reason, duration_ms, replay_json)
       VALUES ($1, $2, $3, $4, $5, (SELECT id FROM "Maps" LIMIT 1), $6, $7, $8, $9)
       ON CONFLICT (id) DO NOTHING;`,
      [
        matchId,
        userId,
        player2UserId || userId,
        bot1RecordId,
        bot2RecordId,
        winnerId,
        game.winReason || 'CHECKMATE',
        durationMs,
        JSON.stringify(replayJson),
      ]
    );

    // Update player Elo if won or lost (both P1 and P2!)
    if (userId) {
      const eloDelta1 = game.winner === 1 ? 16 : game.winner === 2 ? -12 : 0;
      await query(
        'UPDATE "Users" SET elo_rating = GREATEST(1000, elo_rating + $1), updated_at = NOW() WHERE id = $2',
        [eloDelta1, userId]
      );
    }
    if (player2UserId && player2UserId !== userId) {
      const eloDelta2 = game.winner === 2 ? 16 : game.winner === 1 ? -12 : 0;
      await query(
        'UPDATE "Users" SET elo_rating = GREATEST(1000, elo_rating + $1), updated_at = NOW() WHERE id = $2',
        [eloDelta2, player2UserId]
      );
    }
  } catch (dbErr) {
    console.warn('[AutoMatch DB Warning]:', dbErr.message);
  }

  const p2DisplayName = player2Username ? `${player2Username} (Sinh Viên)` : bot2Name;

  return {
    success: true,
    matchId,
    winner: game.winner,
    winnerName: game.winner === 1 ? userName : (player2Username || bot2Name),
    winReason: game.winReason,
    totalTurns: game.turnCount,
    durationMs,
    p1Name: userName,
    p1BotName: bot1Name,
    p2Name: p2DisplayName,
    p2BotName: bot2Name,
    isPvP: !!player2UserId,
    replay: replayJson,
  };
}

module.exports = {
  createPracticeMatch,
  submitPlayerMove,
  getReplay,
  previewMap,
  getRecentMatches,
  getLeaderboard,
  runAutomatedBotDuel,
  runPvPDuel,
};
