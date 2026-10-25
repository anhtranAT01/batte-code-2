/**
 * Tournament Service - Manages Large-scale Swiss-system Tournaments (up to 1000 participants)
 * and dispatches parallel matches to BullMQ Judge Workers
 */

const { query, pool } = require('../config/db');
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
/**
 * Register a student and their bot to a tournament (supports choosing/updating team)
 */
async function registerStudent({tournamentId,userId,botId=null,teamName=null}) {
  const client=await pool.connect();
  const fail=(message,statusCode=400)=>{throw Object.assign(new Error(message),{statusCode});};
  try {
    await client.query('BEGIN');
    const tourney=(await client.query('SELECT * FROM "Tournaments" WHERE id=$1 FOR UPDATE',[tournamentId])).rows[0];
    if(!tourney)fail('Không tìm thấy giải đấu.',404);
    const settings=tourney.settings_json||{},participants=settings.participants||[];
    const existingIndex=participants.findIndex(p=>p.userId===userId);

    // Only reject if tournament has completed or cancelled
    if(tourney.status==='COMPLETED'||tourney.status==='CANCELLED') {
      fail('Giải đấu đã kết thúc hoặc đã hủy. Không nhận thêm đăng ký.');
    }
    if(participants.length>=tourney.max_participants && existingIndex===-1) {
      fail('Giải đấu đã đủ số lượng đăng ký.');
    }

    const user=(await client.query('SELECT username,elo_rating,team_name FROM "Users" WHERE id=$1',[userId])).rows[0];
    if(!user)fail('Không tìm thấy tài khoản người dùng.',404);

    const cleanTeamName = (teamName !== undefined && teamName !== null && String(teamName).trim() !== '')
      ? String(teamName).trim().slice(0, 100)
      : (user.team_name || null);

    if (cleanTeamName && cleanTeamName !== user.team_name) {
      await client.query('UPDATE "Users" SET team_name=$1 WHERE id=$2', [cleanTeamName, userId]);
    }

    let bot = null;
    if (botId) {
      bot=(await client.query(`SELECT name,file_path_or_git_url FROM "Bots" WHERE id=$1 AND user_id=$2 AND status='active'`,[botId,userId])).rows[0];
    }

    if (existingIndex !== -1) {
      const existing = participants[existingIndex];
      if (bot) {
        existing.botId = botId;
        existing.botName = bot.name;
        existing.botPath = bot.file_path_or_git_url;
      }
      if (cleanTeamName !== undefined) {
        existing.teamName = cleanTeamName;
      }
      settings.participants = participants;
      await client.query('UPDATE "Tournaments" SET settings_json=$1 WHERE id=$2',[JSON.stringify(settings),tournamentId]);
      await client.query('COMMIT');
      return {
        success: true,
        message: 'Máy chủ đã ghi nhận và cập nhật thông tin tham gia giải đấu.',
        totalParticipants: participants.length,
        teamName: cleanTeamName
      };
    }

    if (!bot) fail('Hãy chọn bot của bạn đã được máy chủ kiểm tra.');

    participants.push({
      id: userId,
      userId,
      botId,
      botName: bot.name,
      botPath: bot.file_path_or_git_url,
      username: user.username,
      teamName: cleanTeamName,
      elo: user.elo_rating,
      initialElo: user.elo_rating,
      points: 0,
      registeredAt: new Date().toISOString()
    });
    settings.participants = participants;
    await client.query('UPDATE "Tournaments" SET settings_json=$1 WHERE id=$2',[JSON.stringify(settings),tournamentId]);
    await client.query('COMMIT');
    return {
      success: true,
      message: 'Máy chủ đã nhận đăng ký giải đấu.',
      totalParticipants: participants.length,
      teamName: cleanTeamName
    };
  } catch(error){
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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
      teamName: p.teamName || p.team_name || null,
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
 * Student joins or assigns themselves into a specific bracket slot
 */
async function joinBracketSlot({ tournamentId, userId, bracketMatchId, slot = 'p1', botId = null, teamName = null }) {
  const client = await pool.connect();
  const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
  try {
    await client.query('BEGIN');
    const tourney = (await client.query('SELECT * FROM "Tournaments" WHERE id = $1 FOR UPDATE', [tournamentId])).rows[0];
    if (!tourney) fail('Không tìm thấy giải đấu.', 404);

    if (tourney.status === 'COMPLETED' || tourney.status === 'CANCELLED') {
      fail('Giải đấu đã kết thúc hoặc đã hủy.');
    }

    const user = (await client.query('SELECT username, elo_rating, team_name FROM "Users" WHERE id = $1', [userId])).rows[0];
    if (!user) fail('Không tìm thấy tài khoản người dùng.', 404);

    const cleanTeamName = (teamName !== undefined && teamName !== null && String(teamName).trim() !== '')
      ? String(teamName).trim().slice(0, 100)
      : (user.team_name || null);

    if (cleanTeamName && cleanTeamName !== user.team_name) {
      await client.query('UPDATE "Users" SET team_name = $1 WHERE id = $2', [cleanTeamName, userId]);
    }

    let bot = null;
    if (botId) {
      bot = (await client.query(`SELECT name, file_path_or_git_url FROM "Bots" WHERE id = $1 AND user_id = $2 AND status = 'active'`, [botId, userId])).rows[0];
    }
    if (!bot) {
      bot = (await client.query(`SELECT name, file_path_or_git_url FROM "Bots" WHERE user_id = $1 AND status = 'active' ORDER BY is_active DESC, updated_at DESC LIMIT 1`, [userId])).rows[0];
    }

    let brackets = tourney.brackets_json || [];
    let match = brackets.find(b => b.id === bracketMatchId);
    if (!match) {
      match = brackets.find(b => b.round === 1) || brackets[0];
    }
    if (!match) fail('Giải đấu chưa có sơ đồ nhánh đấu.', 400);

    const slotKey = slot === 'p2' ? 'p2' : 'p1';
    match[slotKey] = {
      id: userId,
      name: user.username,
      bot: bot ? bot.name : 'Custom Bot',
      team: cleanTeamName,
      score: null,
    };

    // Also sync with settings.participants
    const settings = tourney.settings_json || {};
    const participants = settings.participants || [];
    const existingIndex = participants.findIndex(p => p.userId === userId);
    if (existingIndex !== -1) {
      participants[existingIndex].teamName = cleanTeamName;
      if (bot) {
        participants[existingIndex].botId = botId || participants[existingIndex].botId;
        participants[existingIndex].botName = bot.name;
        participants[existingIndex].botPath = bot.file_path_or_git_url;
      }
    } else {
      participants.push({
        id: userId,
        userId,
        botId: botId || bot?.id || null,
        botName: bot ? bot.name : 'Custom Bot',
        botPath: bot ? bot.file_path_or_git_url : null,
        username: user.username,
        teamName: cleanTeamName,
        elo: user.elo_rating,
        initialElo: user.elo_rating,
        points: 0,
        registeredAt: new Date().toISOString(),
      });
    }
    settings.participants = participants;

    await client.query(
      'UPDATE "Tournaments" SET brackets_json = $1, settings_json = $2, updated_at = NOW() WHERE id = $3',
      [JSON.stringify(brackets), JSON.stringify(settings), tournamentId]
    );

    await client.query('COMMIT');
    return {
      success: true,
      message: `Đã ghi danh vào ${match.title} (${slotKey.toUpperCase()}) thành công!`,
      data: brackets,
      matchId: match.id,
      slot: slotKey,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * List all tournaments
 */
/**
 * List all tournaments
 */
async function listTournaments() {
  const res = await query('SELECT * FROM "Tournaments" ORDER BY created_at DESC');
  return res.rows;
}

/**
 * Update/rename team for a user across profile and tournaments
 */
async function updateUserTeam({ userId, teamName, tournamentId = null }) {
  const client = await pool.connect();
  const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
  try {
    await client.query('BEGIN');
    const cleanTeamName = (teamName && String(teamName).trim()) ? String(teamName).trim().slice(0, 100) : null;

    // 1. Update Users table
    await client.query('UPDATE "Users" SET team_name = $1 WHERE id = $2', [cleanTeamName, userId]);

    // 2. Update Tournaments where this user is participating
    const tourneysQuery = tournamentId 
      ? await client.query('SELECT id, settings_json FROM "Tournaments" WHERE id = $1 FOR UPDATE', [tournamentId])
      : await client.query('SELECT id, settings_json FROM "Tournaments" WHERE status != \'COMPLETED\' FOR UPDATE');

    for (const row of tourneysQuery.rows) {
      const settings = row.settings_json || {};
      const participants = settings.participants || [];
      const userPart = participants.find(p => p.userId === userId);
      if (userPart) {
        userPart.teamName = cleanTeamName;
        settings.participants = participants;
        await client.query('UPDATE "Tournaments" SET settings_json = $1 WHERE id = $2', [JSON.stringify(settings), row.id]);
      }
    }

    await client.query('COMMIT');
    return {
      success: true,
      message: cleanTeamName ? `Đã cập nhật tên đội thành "${cleanTeamName}".` : 'Đã chuyển sang thi đấu cá nhân.',
      teamName: cleanTeamName,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Retrieve unique list of active teams for suggestions & search
 */
async function getTournamentTeams(tournamentId = null) {
  const teamsMap = new Map();

  // 1. From Users table
  const usersRes = await query('SELECT team_name, COUNT(*)::int AS member_count FROM "Users" WHERE team_name IS NOT NULL AND TRIM(team_name) != \'\' GROUP BY team_name');
  for (const row of usersRes.rows) {
    const name = row.team_name.trim();
    teamsMap.set(name, { name, memberCount: row.member_count });
  }

  // 2. From Tournaments participants
  const tourneysQuery = tournamentId
    ? await query('SELECT settings_json FROM "Tournaments" WHERE id = $1', [tournamentId])
    : await query('SELECT settings_json FROM "Tournaments" WHERE status != \'COMPLETED\'');

  for (const row of tourneysQuery.rows) {
    const participants = row.settings_json?.participants || [];
    for (const p of participants) {
      const tName = p.teamName || p.team_name;
      if (tName && String(tName).trim()) {
        const name = String(tName).trim();
        if (!teamsMap.has(name)) {
          teamsMap.set(name, { name, memberCount: 1 });
        }
      }
    }
  }

  const teams = Array.from(teamsMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  return teams;
}

module.exports = {
  createTournament,
  registerStudent,
  startTournament,
  getTournamentStandings,
  updateTournamentSchedule,
  updateTournamentBrackets,
  listTournaments,
  updateUserTeam,
  getTournamentTeams,
  joinBracketSlot,
};
