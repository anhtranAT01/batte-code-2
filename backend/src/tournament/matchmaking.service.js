/**
 * Matchmaking Service - Real-time Elo Queue Pairing
 */

const { query } = require('../config/db');
const { matchQueue } = require('../config/redis');

// Active players waiting in matchmaking queue
const waitingQueue = [];

/**
 * Join Ranked Matchmaking Queue
 */
async function joinMatchmaking({ userId, botId = null }) {
  // Fetch user details
  const userRes = await query('SELECT id, username, elo_rating FROM "Users" WHERE id = $1', [userId]);
  const user = userRes.rows[0];
  if (!user) {
    throw new Error('Không tìm thấy thông tin người dùng.');
  }

  // Remove existing entry if any
  const existingIndex = waitingQueue.findIndex((entry) => entry.userId === userId);
  if (existingIndex !== -1) {
    waitingQueue.splice(existingIndex, 1);
  }

  const userElo = user.elo_rating || 1200;
  let matchedOpponent = null;
  let opponentIndex = -1;

  // Search for player with closest Elo (delta <= 100 initially)
  const MAX_ELO_DIFF = 120;
  for (let i = 0; i < waitingQueue.length; i++) {
    const candidate = waitingQueue[i];
    const diff = Math.abs(candidate.elo - userElo);
    if (diff <= MAX_ELO_DIFF) {
      matchedOpponent = candidate;
      opponentIndex = i;
      break;
    }
  }

  if (matchedOpponent) {
    // Found opponent! Remove them from queue
    waitingQueue.splice(opponentIndex, 1);

    // Create match in DB
    const mapIdRes = await query('SELECT id FROM "Maps" LIMIT 1');
    const defaultMapId = mapIdRes.rows[0]?.id;

    const matchInsert = await query(
      `INSERT INTO "Matches" (player1_id, player2_id, player1_bot_id, player2_bot_id, map_id, duration_ms)
       VALUES ($1, $2, $3, $4, $5, 0)
       RETURNING id;`,
      [userId, matchedOpponent.userId, botId, matchedOpponent.botId, defaultMapId]
    );

    const matchId = matchInsert.rows[0].id;

    // Dispatch match to BullMQ
    await matchQueue.add(
      'judge-match',
      {
        matchId,
        player1Id: userId,
        player2Id: matchedOpponent.userId,
        player1BotId: botId,
        player2BotId: matchedOpponent.botId,
        maxTurns: 150,
      },
      {
        jobId: `ranked_${matchId}`,
      }
    );

    return {
      status: 'MATCH_FOUND',
      matchId,
      player1: { userId, username: user.username, elo: userElo },
      player2: { userId: matchedOpponent.userId, username: matchedOpponent.username, elo: matchedOpponent.elo },
    };
  }

  // No match found yet, enqueue player
  waitingQueue.push({
    userId,
    username: user.username,
    botId,
    elo: userElo,
    joinedAt: Date.now(),
  });

  return {
    status: 'QUEUED',
    message: 'Đã tham gia hàng chờ ghép trận xếp hạng. Đang tìm đối thủ có Elo tương đương...',
    queueLength: waitingQueue.length,
    currentElo: userElo,
  };
}

/**
 * Leave Matchmaking Queue
 */
function leaveMatchmaking(userId) {
  const idx = waitingQueue.findIndex((entry) => entry.userId === userId);
  if (idx !== -1) {
    waitingQueue.splice(idx, 1);
    return { success: true, message: 'Đã rời khỏi hàng chờ ghép trận.' };
  }
  return { success: false, message: 'Bạn không ở trong hàng chờ.' };
}

module.exports = {
  joinMatchmaking,
  leaveMatchmaking,
};
