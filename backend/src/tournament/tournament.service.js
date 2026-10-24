/**
 * Tournament Service - Manages Large-scale Swiss-system Tournaments (up to 1000 participants)
 * and dispatches parallel matches to BullMQ Judge Workers
 */

const { query } = require('../config/db');
const { matchQueue } = require('../config/redis');
const { generateSwissPairings } = require('./swissPairing');

/**
 * Create a new tournament
 */
async function createTournament({ name, maxParticipants = 1000, settings = {} }) {
  const finalSettings = {
    totalRounds: settings.totalRounds || 7, // 7 rounds for up to 1000 participants in Swiss
    currentRound: 0,
    boardSize: settings.boardSize || 8,
    difficulty: settings.difficulty || 'medium',
    participants: [], // [{ userId, botId, username, elo, points }]
    rounds: [],       // [{ roundNumber, matches: [matchId, ...] }]
    ...settings,
  };

  const sql = `
    INSERT INTO "Tournaments" (name, status, max_participants, settings_json)
    VALUES ($1, 'UPCOMING', $2, $3)
    RETURNING id, name, status, max_participants, settings_json, created_at;
  `;
  const res = await query(sql, [name, maxParticipants, JSON.stringify(finalSettings)]);
  return res.rows[0];
}

/**
 * Register a student and their bot to a tournament
 */
async function registerStudent({ tournamentId, userId, botId = null }) {
  const tourneyRes = await query('SELECT * FROM "Tournaments" WHERE id = $1', [tournamentId]);
  const tourney = tourneyRes.rows[0];
  if (!tourney) {
    const error = new Error('Không tìm thấy giải đấu.');
    error.statusCode = 404;
    throw error;
  }

  if (tourney.status !== 'UPCOMING') {
    const error = new Error('Giải đấu đã bắt đầu hoặc đã kết thúc. Không thể đăng ký thêm.');
    error.statusCode = 400;
    throw error;
  }

  const settings = tourney.settings_json || {};
  const participants = settings.participants || [];

  if (participants.length >= tourney.max_participants) {
    const error = new Error(`Giải đấu đã đạt giới hạn tối đa ${tourney.max_participants} thí sinh.`);
    error.statusCode = 400;
    throw error;
  }

  // Check if already registered
  const existing = participants.find((p) => p.userId === userId);
  if (existing) {
    const error = new Error('Bạn đã đăng ký tham gia giải đấu này rồi.');
    error.statusCode = 400;
    throw error;
  }

  // Fetch user and bot info
  const userRes = await query('SELECT username, elo_rating FROM "Users" WHERE id = $1', [userId]);
  const user = userRes.rows[0];
  if (!user) {
    const error = new Error('Không tìm thấy người dùng.');
    error.statusCode = 404;
    throw error;
  }

  let botName = 'Chưa chọn Bot';
  let botPath = null;
  if (botId) {
    const botRes = await query('SELECT name, file_path_or_git_url FROM "Bots" WHERE id = $1', [botId]);
    if (botRes.rows[0]) {
      botName = botRes.rows[0].name;
      botPath = botRes.rows[0].file_path_or_git_url;
    }
  }

  participants.push({
    id: userId,
    userId,
    botId,
    botName,
    botPath,
    username: user.username,
    elo: user.elo_rating,
    initialElo: user.elo_rating,
    points: 0,
    registeredAt: new Date().toISOString(),
  });

  settings.participants = participants;

  await query('UPDATE "Tournaments" SET settings_json = $1 WHERE id = $2', [
    JSON.stringify(settings),
    tournamentId,
  ]);

  return {
    success: true,
    message: `Đăng ký thành công cho ${user.username}! Hiện có ${participants.length}/${tourney.max_participants} thí sinh.`,
    totalParticipants: participants.length,
  };
}

/**
 * Start tournament and dispatch Round 1 matches
 */
async function startTournament(tournamentId) {
  const tourneyRes = await query('SELECT * FROM "Tournaments" WHERE id = $1', [tournamentId]);
  const tourney = tourneyRes.rows[0];
  if (!tourney) {
    const error = new Error('Không tìm thấy giải đấu.');
    error.statusCode = 404;
    throw error;
  }

  const settings = tourney.settings_json || {};
  const participants = settings.participants || [];

  if (participants.length < 2) {
    const error = new Error('Cần ít nhất 2 thí sinh để bắt đầu giải đấu.');
    error.statusCode = 400;
    throw error;
  }

  settings.currentRound = 1;

  // Generate Swiss Pairings for Round 1
  const { pairings, bye } = generateSwissPairings(participants, []);

  // Dispatch matches to database and BullMQ
  const roundMatches = [];
  const mapIdRes = await query('SELECT id FROM "Maps" LIMIT 1');
  const defaultMapId = mapIdRes.rows[0]?.id;

  for (const pair of pairings) {
    const matchInsert = await query(
      `INSERT INTO "Matches" (tournament_id, player1_id, player2_id, player1_bot_id, player2_bot_id, map_id, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6, 0)
       RETURNING id;`,
      [tournamentId, pair.player1.userId, pair.player2.userId, pair.player1.botId, pair.player2.botId, defaultMapId]
    );

    const matchId = matchInsert.rows[0].id;
    roundMatches.push(matchId);

    // Push match job to BullMQ distributed queue
    await matchQueue.add(
      'judge-match',
      {
        matchId,
        tournamentId,
        player1Id: pair.player1.userId,
        player2Id: pair.player2.userId,
        player1BotId: pair.player1.botId,
        player2BotId: pair.player2.botId,
        bot1Path: pair.player1.botPath,
        bot2Path: pair.player2.botPath,
        maxTurns: 150,
      },
      {
        jobId: `match_${matchId}`,
      }
    );
  }

  // Handle Bye if odd participants (+1 point)
  if (bye) {
    const byePlayer = participants.find((p) => p.userId === bye.userId);
    if (byePlayer) byePlayer.points = (byePlayer.points || 0) + 1;
  }

  settings.rounds = settings.rounds || [];
  settings.rounds.push({
    roundNumber: 1,
    matches: roundMatches,
    byeUserId: bye ? bye.userId : null,
    startedAt: new Date().toISOString(),
  });

  await query(
    'UPDATE "Tournaments" SET status = \'ONGOING\', settings_json = $1, updated_at = NOW() WHERE id = $2',
    [JSON.stringify(settings), tournamentId]
  );

  return {
    success: true,
    message: `Giải đấu "${tourney.name}" đã bắt đầu Vòng 1 với ${pairings.length} cặp đấu!`,
    currentRound: 1,
    totalMatchesDispatched: pairings.length,
    byeParticipant: bye ? bye.username : null,
  };
}

/**
 * Compute standings and statistics for tournament participants
 */
async function getTournamentStandings(tournamentId) {
  const tourneyRes = await query('SELECT * FROM "Tournaments" WHERE id = $1', [tournamentId]);
  const tourney = tourneyRes.rows[0];
  if (!tourney) {
    const error = new Error('Không tìm thấy giải đấu.');
    error.statusCode = 404;
    throw error;
  }

  const settings = tourney.settings_json || {};
  const participants = settings.participants || [];

  // Query all matches played in this tournament
  const matchesRes = await query(
    `SELECT m.id, m.player1_id, m.player2_id, m.winner_id, m.win_reason,
            m.duration_ms, m.p1_elo_change, m.p2_elo_change, m.has_infinite_loop_error,
            m.replay_json
     FROM "Matches" m
     WHERE m.tournament_id = $1`,
    [tournamentId]
  );
  const matches = matchesRes.rows;

  // Aggregate stats per participant
  const standings = participants.map((p) => {
    let matchesPlayed = 0;
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let totalEloDelta = 0;
    let winDurations = [];
    let turnsList = [];
    let infiniteLoopErrors = 0;

    for (const m of matches) {
      const isP1 = m.player1_id === p.userId;
      const isP2 = m.player2_id === p.userId;

      if (!isP1 && !isP2) continue;

      matchesPlayed++;

      if (m.winner_id === p.userId) {
        wins++;
        if (m.duration_ms > 0) winDurations.push(m.duration_ms);
      } else if (m.winner_id && m.winner_id !== p.userId) {
        losses++;
      } else if (m.win_reason === 'DRAW') {
        draws++;
      }

      totalEloDelta += isP1 ? (m.p1_elo_change || 0) : (m.p2_elo_change || 0);

      // Check if this player caused infinite loop / timeout
      if (m.has_infinite_loop_error) {
        if (m.winner_id && m.winner_id !== p.userId) {
          infiniteLoopErrors++;
        }
      }

      if (Array.isArray(m.replay_json) && m.replay_json.length > 0) {
        turnsList.push(m.replay_json.length);
      }
    }

    const calculatedPoints = wins * 1 + draws * 0.5 + (p.points > (wins + draws * 0.5) ? (p.points - wins - draws * 0.5) : 0);
    const winRate = matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0;
    const avgWinDurationMs =
      winDurations.length > 0
        ? Math.round(winDurations.reduce((a, b) => a + b, 0) / winDurations.length)
        : 0;
    const avgTurns =
      turnsList.length > 0
        ? Math.round(turnsList.reduce((a, b) => a + b, 0) / turnsList.length)
        : 0;

    return {
      userId: p.userId,
      username: p.username,
      botName: p.botName || 'Chưa nộp Bot',
      botStatus: infiniteLoopErrors > 0 ? 'error' : 'active',
      points: calculatedPoints,
      elo: p.elo + totalEloDelta,
      eloDelta: totalEloDelta,
      matchesPlayed,
      wins,
      losses,
      draws,
      winRate,
      avgWinDurationMs,
      avgTurns,
      infiniteLoopErrors,
    };
  });

  // Sort descending by points, then by Elo, then by winRate
  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.elo !== a.elo) return b.elo - a.elo;
    return b.winRate - a.winRate;
  });

  return {
    tournament: {
      id: tourney.id,
      name: tourney.name,
      status: tourney.status,
      maxParticipants: tourney.max_participants,
      currentRound: settings.currentRound || 0,
      totalRounds: settings.totalRounds || 7,
      totalMatches: matches.length,
      scheduledStartAt: tourney.scheduled_start_at,
      brackets: tourney.brackets_json || [],
    },
    standings,
  };
}

/**
 * Update tournament schedule (Set start time)
 */
async function updateTournamentSchedule(tournamentId, scheduledStartAt) {
  const res = await query(
    'UPDATE "Tournaments" SET scheduled_start_at = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [scheduledStartAt, tournamentId]
  );
  return res.rows[0];
}

/**
 * Update tournament brackets (Admin assigns who goes to which bracket)
 */
async function updateTournamentBrackets(tournamentId, bracketsData) {
  const res = await query(
    'UPDATE "Tournaments" SET brackets_json = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [JSON.stringify(bracketsData), tournamentId]
  );
  return res.rows[0];
}

/**
 * List all tournaments
 */
async function listTournaments() {
  const res = await query('SELECT * FROM "Tournaments" ORDER BY created_at DESC');
  return res.rows;
}

module.exports = {
  createTournament,
  registerStudent,
  startTournament,
  getTournamentStandings,
  updateTournamentSchedule,
  updateTournamentBrackets,
  listTournaments,
};
