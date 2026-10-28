/**
 * Game Service - Orchestrates Practice Matches, Engine Updates, and Replay Persistence
 */

const { GameEngine } = require('./gameEngine');
const { getPracticeBot } = require('./practiceBots');
const { generateMap } = require('./mapGenerator');
const { query } = require('../config/db');
const crypto = require('crypto');
const { normalizeMatch } = require('./matchHistory');
const { replayExpiresSql,replayExpiredSql } = require('./replayPolicy');

// In-memory active game sessions
const activeMatches = new Map();
// Release abandoned practice sessions instead of retaining every board forever.
function pruneInactiveMatches(now=Date.now()) {
  for(const [id,session] of activeMatches) if(now-(session.lastActivityAt || session.createdAt)>60*60_000) activeMatches.delete(id);
}
const sessionSweeper=setInterval(pruneInactiveMatches,5*60_000);
sessionSweeper.unref();

function forgetDeletedData({matchId,userId}) {
  if (matchId) activeMatches.delete(matchId);
  if (userId) for (const [id,session] of activeMatches) {
    if (session.userId === userId) activeMatches.delete(id);
  }
}

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
  const matchId = crypto.randomUUID();
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
  session.lastActivityAt=Date.now();

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
      Object.assign(replayJson,{mode:'PRACTICE',p1Name:session.userName,p2Name:`Boss AI (${session.botLevel})`,p2BotName:`Boss AI (${session.botLevel})`});
      if (session.userId) {
        const persisted = await query(
          `INSERT INTO "Matches" (id, player1_id, player2_id, map_id, winner_id, win_reason, duration_ms, replay_json,judged_at)
           VALUES ($1, $2, NULL, (SELECT id FROM "Maps" LIMIT 1), $3, $4, $5, $6,NOW())
           ON CONFLICT (id) DO NOTHING RETURNING match_number;`,
          [
            matchId,
            session.userId,
            game.winner === 1 ? session.userId : null,
            game.winReason,
            Date.now() - session.createdAt,
            JSON.stringify(replayJson),
          ]
        );
        session.matchNumber = persisted.rows[0]?.match_number || session.matchNumber;
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
    replay: game.isGameOver ? {...game.getReplayJson(),matchNumber:session.matchNumber} : null,
  };
}

/**
 * Retrieve replay for playback from RAM or PostgreSQL Database
 */
async function getReplay(matchId) {
  pruneInactiveMatches();
  // 1. Check in-memory active match sessions
  const session = activeMatches.get(matchId);
  if (session) {
    return {...session.game.getReplayJson(),matchNumber:session.matchNumber,mode:'PRACTICE',p1Name:session.userName,
      p2Name:`Boss AI (${session.botLevel})`,p2BotName:`Boss AI (${session.botLevel})`};
  }

  // 2. Query historical matches from PostgreSQL database
  try {
    const input = String(matchId).trim();
    const number = input.replace(/^#/,'');
    const byNumber = /^\d{1,19}$/.test(number) && BigInt(number) <= 9223372036854775807n;
    const byUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input);
    const res = await query(
      `SELECT m.id, m.match_number, m.player1_id, m.player2_id, m.player2_bot_id, m.winner_id, m.win_reason, m.duration_ms, m.replay_json,
              ${replayExpiredSql()} AS replay_expired_at,${replayExpiresSql()} AS replay_expires_at,
              u1.username AS p1_username, u2.username AS p2_username,
              b1.name AS p1_bot_name, b2.name AS p2_bot_name,
              uw.username AS winner_username
       FROM "Matches" m
       LEFT JOIN "Users" u1 ON u1.id = m.player1_id
       LEFT JOIN "Users" u2 ON u2.id = m.player2_id
       LEFT JOIN "Bots" b1 ON b1.id = m.player1_bot_id
       LEFT JOIN "Bots" b2 ON b2.id = m.player2_bot_id
       LEFT JOIN "Users" uw ON uw.id = m.winner_id
       WHERE ${byNumber ? 'm.match_number = $1::bigint' : byUuid ? 'm.id = $1::uuid' : 'm.id::text = $1 OR m.id::text LIKE $2'} LIMIT 2`,
      byNumber ? [number] : byUuid ? [input] : [input, `${input.replace(/[\\%_]/g,'\\$&')}%`]
    );

    if (res.rows.length > 0) {
      if(res.rows.length > 1) throw Object.assign(new Error('Mã trận khớp nhiều trận. Hãy nhập đầy đủ mã trận.'),{statusCode:400});
      if(res.rows[0].replay_expired_at) throw Object.assign(new Error('Replay đã hết thời gian lưu trữ. Kết quả trận đấu vẫn được giữ.'),{statusCode:410});
      const match = normalizeMatch(res.rows[0]);
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
          matchNumber: match.match_number,
          p1Name: match.p1_username || 'Phe Xanh (P1)',
          p2Name: match.p2_username || 'Phe Đỏ (P2)',
          p1BotName: match.p1_bot_name,
          p2BotName: match.p2_bot_name,
          winnerName: match.winner_username,
          winReason: match.win_reason,
          durationMs: match.duration_ms,
          replayExpiresAt: match.replay_expires_at,
        };
      }

      if (Array.isArray(replay)) {
        return {
          matchId: match.id,
          matchNumber: match.match_number,
          steps: replay,
          replayExpiresAt: match.replay_expires_at,
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
    if(err.statusCode)throw err;
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

const { getRecentMatches, getLeaderboard, invalidateArenaReads } = require('./arenaReads');
const duelExecutor = require('./duelExecutor');

const { resolveBotPath } = require('../bot/botStorage');
const { getTemplateBot } = require('./botDuel');

async function runPvPDuel({userId,userName,opponentUserId,boardSize = 9,...execution}) {
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
    boardSize,difficulty:'medium',...execution});
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
  onProgress, signal, requestKey,
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

  const metadata = {mode:player2UserId ? 'PVP' : 'PRACTICE',p1Name:userName,
    p2Name:player2Username || bot2Name,p1BotName:bot1Name,p2BotName:bot2Name};
  const simulated = await duelExecutor.run({matchId,size:validSize,difficulty,participants:{
    1:{name:bot1Name,level:template1?.bot.level,scriptPath:bot1ScriptPath},
    2:{name:bot2Name,level:systemBot2?.level,scriptPath:bot2ScriptPath},
  }},{signal,owner:userId || requestKey,onProgress:event => {
    if (event.type === 'started') event = {...event,data:{...metadata,matchId,isPvP:!!player2UserId,
      replay:{...event.data.replay,...metadata}}};
    onProgress?.(event);
  }});
  const {durationMs,replay:replayJson} = simulated;
  const game = {winner:simulated.winner,winReason:simulated.winReason,turnCount:simulated.totalTurns};
  Object.assign(replayJson,metadata);

  // Persist match in database if user is logged in
  try {
    const winnerId = game.winner === 1 ? userId : (game.winner === 2 && player2UserId ? player2UserId : null);
    const persisted = await query(
      `INSERT INTO "Matches" (id, player1_id, player2_id, player1_bot_id, player2_bot_id, map_id, winner_id, win_reason, duration_ms, replay_json,judged_at)
       VALUES ($1, $2, $3, $4, $5, (SELECT id FROM "Maps" LIMIT 1), $6, $7, $8, $9,NOW())
       ON CONFLICT (id) DO NOTHING RETURNING match_number;`,
      [
        matchId,
        userId,
        player2UserId,
        bot1RecordId,
        bot2RecordId,
        winnerId,
        game.winReason || 'CHECKMATE',
        durationMs,
        JSON.stringify(replayJson),
      ]
    );
    if (persisted.rows[0]?.match_number) replayJson.matchNumber = persisted.rows[0].match_number;

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

  invalidateArenaReads();
  const p2DisplayName = player2Username ? `${player2Username} (Sinh Viên)` : bot2Name;

  return {
    success: true,
    matchId,
    matchNumber: replayJson.matchNumber,
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
  forgetDeletedData,
  createPracticeMatch,
  submitPlayerMove,
  getReplay,
  previewMap,
  getRecentMatches,
  getLeaderboard,
  runAutomatedBotDuel,
  runPvPDuel,
};
