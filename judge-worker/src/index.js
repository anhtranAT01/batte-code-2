const { Worker } = require('bullmq');
const Redis = require('ioredis');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const {
  createInitialBoard,
  isValidMove,
  executeMove,
  checkPlayerStatus,
} = require('./engine/rpsEngine');
const { executePythonBot } = require('./runner/pythonRunner');

dotenv.config();

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://rps_admin:rps_secret_password_2026@127.0.0.1:5432/rps_arena?schema=public';

function getPoolConnectionOptions(rawConnectionString) {
  try {
    const url = new URL(rawConnectionString);
    const sslMode = url.searchParams.get('sslmode');
    const needsSsl = url.hostname.endsWith('.supabase.com') || Boolean(sslMode);
    url.searchParams.delete('sslmode');
    url.searchParams.delete('uselibpqcompat');
    return {
      connectionString: url.toString(),
      ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    };
  } catch {
    return { connectionString: rawConnectionString };
  }
}

const pool = new Pool({
  ...getPoolConnectionOptions(connectionString),
  max: 15,
  idleTimeoutMillis: 30000,
});

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null,
};

if (process.env.REDIS_PASSWORD) redisConfig.password = process.env.REDIS_PASSWORD;

const redisConnection = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
  : redisConfig;

const TURN_TIMEOUT_MS = parseInt(process.env.TURN_TIMEOUT_MS || '1000', 10);

/**
 * Standard Elo calculation
 */
function calculateElo(p1Rating, p2Rating, outcome) {
  const K = 32;
  const expectedP1 = 1 / (1 + Math.pow(10, (p2Rating - p1Rating) / 400));
  const expectedP2 = 1 - expectedP1;

  const p1Change = Math.round(K * (outcome - expectedP1));
  const p2Change = Math.round(K * ((1 - outcome) - expectedP2));

  return { p1Change, p2Change };
}

/**
 * Simulate / Judge a Match between two bots
 */
async function processMatchJob(job) {
  const {
    matchId,
    player1Id,
    player2Id,
    player1BotId,
    player2BotId,
    bot1Path: providedBot1Path,
    bot2Path: providedBot2Path,
    mapConfig,
    maxTurns = 150,
    tournamentId = null,
  } = job.data;

  console.log(`[Judge Worker] Processing match ${matchId} | P1: ${player1Id} vs P2: ${player2Id}`);

  // Resolve bot paths from DB if not directly provided
  let bot1Path = providedBot1Path;
  let bot2Path = providedBot2Path;

  try {
    if (!bot1Path && player1BotId) {
      const res = await pool.query('SELECT file_path_or_git_url FROM "Bots" WHERE id = $1', [player1BotId]);
      bot1Path = res.rows[0]?.file_path_or_git_url;
    }
    if (!bot2Path && player2BotId) {
      const res = await pool.query('SELECT file_path_or_git_url FROM "Bots" WHERE id = $1', [player2BotId]);
      bot2Path = res.rows[0]?.file_path_or_git_url;
    }
  } catch (lookupErr) {
    console.warn(`[Judge Worker] Bot path lookup warning: ${lookupErr.message}`);
  }

  const startTime = Date.now();
  const boardState = createInitialBoard(mapConfig || { rows: 8, cols: 8 });
  const replay = [];

  let currentTurn = 1; // 1 or 2
  let winnerId = null;
  let winReason = null;
  let hasInfiniteLoopError = false;
  let faultDetails = null;

  const positionHistory = new Map();

  for (let turnCount = 1; turnCount <= maxTurns; turnCount++) {
    // 1. Determine all legal moves for current player
    const validMoves = [];
    for (let r = 0; r < boardState.rows; r++) {
      for (let c = 0; c < boardState.cols; c++) {
        const piece = boardState.grid[r][c];
        if (piece && piece.player === currentTurn && piece.type !== 'F') {
          const deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]];
          for (const [dr, dc] of deltas) {
            const move = { fromRow: r, fromCol: c, toRow: r + dr, toCol: c + dc };
            if (isValidMove(boardState, currentTurn, move)) {
              validMoves.push(move);
            }
          }
        }
      }
    }

    if (validMoves.length === 0) {
      winnerId = currentTurn === 1 ? player2Id : player1Id;
      winReason = 'CHECKMATE';
      break;
    }

    // 2. Obtain chosen move: Run student Python bot if file exists, else use tactical fallback
    const activeBotPath = currentTurn === 1 ? bot1Path : bot2Path;
    const activeBotId = currentTurn === 1 ? player1BotId : player2BotId;

    let chosenMove = null;
    let turnDurationMs = 0;

    if (activeBotPath && fs.existsSync(activeBotPath)) {
      // Execute Python Bot via sandboxed runner
      const inputPayload = {
        player_id: currentTurn,
        turn_number: turnCount,
        grid: boardState.grid,
        valid_moves: validMoves,
      };

      const pyResult = await executePythonBot({
        botScriptPath: activeBotPath,
        inputPayload,
        timeoutMs: TURN_TIMEOUT_MS,
      });

      turnDurationMs = pyResult.durationMs;

      if (!pyResult.success) {
        // Bot crashed, exceeded timeout, or syntax/runtime error
        if (pyResult.hasInfiniteLoop || pyResult.timedOut) {
          hasInfiniteLoopError = true;
          winReason = 'TIMEOUT';
          faultDetails = pyResult.error;
        } else {
          winReason = 'INVALID_MOVE';
          faultDetails = pyResult.error;
        }

        winnerId = currentTurn === 1 ? player2Id : player1Id;

        // Record error to Bot in DB
        if (activeBotId) {
          try {
            await pool.query(
              'UPDATE "Bots" SET error_count = error_count + 1, status = \'error\' WHERE id = $1',
              [activeBotId]
            );
          } catch {}
        }

        replay.push({
          step: turnCount,
          player: currentTurn,
          error: faultDetails,
          hasInfiniteLoop: hasInfiniteLoopError,
          durationMs: turnDurationMs,
        });

        console.log(`[Judge Worker] Player ${currentTurn} bot faulted: ${faultDetails}`);
        break;
      }

      // Verify that bot returned a legal move
      const isLegal = isValidMove(boardState, currentTurn, pyResult.move);
      if (!isLegal) {
        winReason = 'INVALID_MOVE';
        faultDetails = `Nước đi (${pyResult.move?.fromRow},${pyResult.move?.fromCol}) -> (${pyResult.move?.toRow},${pyResult.move?.toCol}) không hợp lệ!`;
        winnerId = currentTurn === 1 ? player2Id : player1Id;

        replay.push({
          step: turnCount,
          player: currentTurn,
          move: pyResult.move,
          error: faultDetails,
          durationMs: turnDurationMs,
        });
        break;
      }

      chosenMove = pyResult.move;
    } else {
      // Internal heuristic bot fallback
      chosenMove = validMoves[Math.floor(Math.random() * validMoves.length)];
      turnDurationMs = 15;
    }

    // 3. Execute the validated move
    const moveEvent = executeMove(boardState, currentTurn, chosenMove);
    moveEvent.step = turnCount;
    moveEvent.durationMs = turnDurationMs;
    replay.push(moveEvent);

    // 4. Repetition Detection (Board cyclic loop)
    const boardHash = JSON.stringify(boardState.grid);
    const count = (positionHistory.get(boardHash) || 0) + 1;
    positionHistory.set(boardHash, count);

    if (count >= 5) {
      hasInfiniteLoopError = true;
      winReason = 'INFINITE_LOOP';
      winnerId = currentTurn === 1 ? player2Id : player1Id;
      console.log(`[Judge Worker] Detected repeated loop 5 times in match ${matchId}. Player ${currentTurn} penalized.`);
      break;
    }

    // 5. Check Flag Captured
    if (moveEvent.outcome === 'FLAG_CAPTURED') {
      winnerId = currentTurn === 1 ? player1Id : player2Id;
      winReason = 'CHECKMATE';
      break;
    }

    // 6. Check Opponent Alive
    const opponent = currentTurn === 1 ? 2 : 1;
    const opponentStatus = checkPlayerStatus(boardState, opponent);
    if (!opponentStatus.isAlive) {
      winnerId = currentTurn === 1 ? player1Id : player2Id;
      winReason = 'CHECKMATE';
      break;
    }

    currentTurn = opponent;
  }

  if (!winReason) {
    winReason = 'DRAW';
  }

  const durationMs = Date.now() - startTime;

  // 7. Calculate Elo & Update Database
  let p1EloChange = 0;
  let p2EloChange = 0;

  try {
    const p1Query = await pool.query('SELECT elo_rating FROM "Users" WHERE id = $1', [player1Id]);
    const p2Query = await pool.query('SELECT elo_rating FROM "Users" WHERE id = $1', [player2Id]);

    const p1Rating = p1Query.rows[0]?.elo_rating || 1200;
    const p2Rating = p2Query.rows[0]?.elo_rating || 1200;

    let outcome = 0.5;
    if (winnerId === player1Id) outcome = 1;
    else if (winnerId === player2Id) outcome = 0;

    const eloResult = calculateElo(p1Rating, p2Rating, outcome);
    p1EloChange = eloResult.p1Change;
    p2EloChange = eloResult.p2Change;

    // Update match record in DB
    await pool.query(
      `UPDATE "Matches"
       SET winner_id = $1, win_reason = $2, duration_ms = $3,
           p1_elo_change = $4, p2_elo_change = $5,
           has_infinite_loop_error = $6, replay_json = $7
       WHERE id = $8`,
      [
        winnerId,
        winReason,
        durationMs,
        p1EloChange,
        p2EloChange,
        hasInfiniteLoopError,
        JSON.stringify(replay),
        matchId,
      ]
    );

    // Update users Elo
    await pool.query('UPDATE "Users" SET elo_rating = elo_rating + $1 WHERE id = $2', [p1EloChange, player1Id]);
    await pool.query('UPDATE "Users" SET elo_rating = elo_rating + $1 WHERE id = $2', [p2EloChange, player2Id]);

    console.log(
      `[Judge Worker] Match ${matchId} ended. Winner: ${winnerId || 'DRAW'} (${winReason}). Duration: ${durationMs}ms. InfiniteLoop: ${hasInfiniteLoopError}`
    );
  } catch (dbErr) {
    console.error('[Judge Worker DB Error]:', dbErr.message);
  }

  return {
    matchId,
    winnerId,
    winReason,
    durationMs,
    hasInfiniteLoopError,
    p1EloChange,
    p2EloChange,
    totalTurns: replay.length,
  };
}

// Start BullMQ Worker with concurrency = 5
const worker = new Worker('match-queue', processMatchJob, {
  connection: redisConnection,
  concurrency: 5,
});

worker.on('completed', (job) => {
  console.log(`[Judge Worker] Match Job ${job.id} completed successfully.`);
});

worker.on('failed', (job, err) => {
  console.error(`[Judge Worker] Match Job ${job.id} failed:`, err.message);
});

console.log(`=======================================================`);
console.log(` RPS Distributed Judge Worker online (Concurrency: 5)`);
console.log(` Timeout Per Turn: ${TURN_TIMEOUT_MS}ms (Infinite Loop Guard)`);
console.log(` Redis Queue: match-queue`);
console.log(`=======================================================`);

module.exports = { processMatchJob };
