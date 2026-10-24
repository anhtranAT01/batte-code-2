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

const path = require('path');
const fs = require('fs');
const { executePythonBot } = require('./pythonRunner');

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

  // Resolve Bot 1 script path
  const sampleBotsDir = path.join(__dirname, '../../../sample-bots');
  let bot1ScriptPath = path.join(sampleBotsDir, 'student_bot_template.py');
  let bot1Name = 'Bot Bản Mẫu';
  let bot1RecordId = null;

  if (bot1Id === 'template_alphabeta') {
    bot1ScriptPath = path.join(sampleBotsDir, 'minimax_alphabeta_bot.py');
    bot1Name = 'Minimax Alpha-Beta Bot';
  } else if (bot1Id === 'template_astar' || bot1Id === 'template_flag_rusher') {
    bot1ScriptPath = path.join(sampleBotsDir, 'flag_rusher_strategy_bot.py');
    bot1Name = 'Chiến Thuật Cướp Cờ (Flag Rusher)';
  } else if (bot1Id && bot1Id !== 'MANUAL') {
    try {
      const bRes = await query('SELECT * FROM "Bots" WHERE id = $1', [bot1Id]);
      if (bRes.rows.length > 0) {
        const b = bRes.rows[0];
        if (fs.existsSync(b.file_path_or_git_url)) {
          bot1ScriptPath = b.file_path_or_git_url;
          bot1Name = b.name;
          bot1RecordId = b.id;
        }
      }
    } catch {}
  }

  // Resolve Bot 2 (System Boss or Student Bot)
  let bot2ScriptPath = null;
  let systemBot2 = null;
  let bot2Name = `Boss AI (${bot2Level})`;
  let bot2RecordId = null;
  let player2UserId = null;
  let player2Username = null;

  if (bot2Id) {
    try {
      const bRes = await query(`
        SELECT b.*, u.id AS owner_id, u.username AS owner_name 
        FROM "Bots" b 
        JOIN "Users" u ON u.id = b.user_id 
        WHERE b.id = $1
      `, [bot2Id]);
      if (bRes.rows.length > 0) {
        const b = bRes.rows[0];
        if (fs.existsSync(b.file_path_or_git_url)) {
          bot2ScriptPath = b.file_path_or_git_url;
          bot2Name = b.name;
          bot2RecordId = b.id;
          player2UserId = b.owner_id;
          player2Username = b.owner_name;
        }
      }
    } catch {}
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

  const startTime = Date.now();
  let turnsCount = 0;

  // Run match simulation turn-by-turn until game over
  while (!game.isGameOver && turnsCount < 150) {
    turnsCount++;

    if (game.currentTurnPlayer === 1) {
      // Player 1's Turn (Python Bot)
      const inputPayload = {
        player_id: 1,
        board_size: validSize,
        grid: game.getBoardSnapshot(),
        turn: game.turnCount,
        my_flag: [0, 0],
        enemy_flag: [validSize - 1, validSize - 1],
        target_flag: [validSize - 1, validSize - 1],
      };

      const p1Result = await executePythonBot({
        botScriptPath: bot1ScriptPath,
        inputPayload,
        timeoutMs: 1000,
      });

      let p1Move = p1Result.move;
      if (!p1Result.success || !p1Move) {
        const legalMoves = game.getValidMovesForPlayer(1);
        if (legalMoves.length > 0) {
          p1Move = legalMoves[0];
        } else {
          game.isGameOver = true;
          game.winner = 2;
          game.winReason = 'ELIMINATION';
          break;
        }
      }

      const moveRes = game.executeMove(1, p1Move, p1Result.durationMs || 50);
      if (!moveRes.success) {
        break;
      }
    } else {
      // Player 2's Turn
      if (bot2ScriptPath) {
        // Player 2 is Python Bot
        const inputPayload = {
          player_id: 2,
          board_size: validSize,
          grid: game.getBoardSnapshot(),
          turn: game.turnCount,
          my_flag: [validSize - 1, validSize - 1],
          enemy_flag: [0, 0],
          target_flag: [0, 0],
        };

        const p2Result = await executePythonBot({
          botScriptPath: bot2ScriptPath,
          inputPayload,
          timeoutMs: 1000,
        });

        let p2Move = p2Result.move;
        if (!p2Result.success || !p2Move) {
          const legalMoves = game.getValidMovesForPlayer(2);
          if (legalMoves.length > 0) {
            p2Move = legalMoves[0];
          } else {
            game.isGameOver = true;
            game.winner = 1;
            game.winReason = 'ELIMINATION';
            break;
          }
        }

        const moveRes = game.executeMove(2, p2Move, p2Result.durationMs || 50);
        if (!moveRes.success) {
          break;
        }
      } else {
        // Player 2 is System Practice Bot
        const botDecision = systemBot2.chooseMove(game);
        if (botDecision && botDecision.move) {
          game.executeMove(2, botDecision.move, botDecision.calculationTimeMs);
        } else {
          game.isGameOver = true;
          game.winner = 1;
          game.winReason = 'ELIMINATION';
          break;
        }
      }
    }
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
};
