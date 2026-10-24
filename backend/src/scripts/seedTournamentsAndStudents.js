/**
 * Comprehensive Database Seeder: Tournaments, Grade Categories, Sample Students, Bots, and Matches
 */

const bcrypt = require('bcryptjs');
const path = require('path');
const { query, pool } = require('../config/db');

async function seedAll() {
  console.log('[Seed] Seeding sample students, bots, tournaments, and match records...');

  try {
    const passwordHash = await bcrypt.hash('123456', 10);

    // 1. Seed Students
    const students = [
      { username: 'hocsinh_duc', elo: 1550, botName: 'Duc_MinimaxMaster_v2', tpl: 'minimax_alphabeta_bot.py' },
      { username: 'hocsinh_nam', elo: 1420, botName: 'Nam_AStarRusher_9x9', tpl: 'astar_flag_rusher_bot.py' },
      { username: 'hocsinh_minh', elo: 1350, botName: 'Minh_HeuristicAlpha', tpl: 'student_bot_template.py' },
      { username: 'hocsinh_lan', elo: 1280, botName: 'Lan_SpeedFlanker', tpl: 'astar_flag_rusher_bot.py' },
      { username: 'hocsinh_nga', elo: 1210, botName: 'Nga_RPS_Defender', tpl: 'student_bot_template.py' },
    ];

    const studentRecords = [];
    const sampleBotsDir = path.join(__dirname, '../../../sample-bots');

    for (const s of students) {
      const uRes = await query(
        `INSERT INTO "Users" (username, password_hash, role, elo_rating)
         VALUES ($1, $2, 'STUDENT', $3)
         ON CONFLICT (username) DO UPDATE SET elo_rating = EXCLUDED.elo_rating
         RETURNING id, username, role, elo_rating;`,
        [s.username, passwordHash, s.elo]
      );
      const user = uRes.rows[0];

      // Seed Bot for Student
      const botPath = path.join(sampleBotsDir, s.tpl);
      const bRes = await query(
        `INSERT INTO "Bots" (user_id, name, source_type, file_path_or_git_url, status, is_active)
         VALUES ($1, $2, 'file', $3, 'active', true)
         ON CONFLICT DO NOTHING
         RETURNING id, name, is_active;`,
        [user.id, s.botName, botPath]
      );

      studentRecords.push({
        user,
        bot: bRes.rows[0] || { id: null, name: s.botName },
      });
    }

    console.log(`✅ Seeded ${studentRecords.length} student accounts and bots.`);

    // 2. Seed Tournaments
    const scheduledTomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const scheduledNextWeek = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

    const participantsKhoid10 = studentRecords.map((s, idx) => ({
      userId: s.user.id,
      username: s.user.username,
      botId: s.bot.id,
      botName: s.bot.name,
      elo: s.user.elo_rating,
      points: [12, 9, 7, 4, 3][idx] || 0,
      wins: [4, 3, 2, 1, 1][idx] || 0,
      losses: [0, 1, 2, 3, 3][idx] || 0,
      draws: [0, 0, 1, 0, 0][idx] || 0,
      winRate: [100, 75, 40, 25, 25][idx] || 0,
      branch: ['Nhánh A', 'Nhánh A', 'Nhánh B', 'Nhánh B', 'Nhánh C'][idx],
    }));

    const settingsKhoid10 = {
      gradeCategory: 'Khối 10',
      totalRounds: 5,
      currentRound: 3,
      boardSize: 9,
      difficulty: 'hard',
      participants: participantsKhoid10,
    };

    const t1 = await query(
      `INSERT INTO "Tournaments" (name, status, max_participants, scheduled_start_at, settings_json, brackets_json)
       VALUES ($1, 'ONGOING', 500, $2, $3, $4)
       RETURNING id, name, status, scheduled_start_at;`,
      [
        'Giải Vô Địch Khối 10 - AI BattleCode Cup 2026',
        scheduledTomorrow,
        JSON.stringify(settingsKhoid10),
        JSON.stringify(participantsKhoid10),
      ]
    );

    const settingsToanTruong = {
      gradeCategory: 'Toàn Trường',
      totalRounds: 7,
      currentRound: 0,
      boardSize: 9,
      difficulty: 'medium',
      participants: participantsKhoid10.map((p) => ({ ...p, points: 0, wins: 0, losses: 0, draws: 0, winRate: 0 })),
    };

    const t2 = await query(
      `INSERT INTO "Tournaments" (name, status, max_participants, scheduled_start_at, settings_json, brackets_json)
       VALUES ($1, 'UPCOMING', 1000, $2, $3, $4)
       RETURNING id, name, status, scheduled_start_at;`,
      [
        'Đấu Trường Toàn Trường - Rock Paper Scissors 9x9',
        scheduledNextWeek,
        JSON.stringify(settingsToanTruong),
        JSON.stringify([]),
      ]
    );

    console.log(`✅ Seeded 2 tournaments: "${t1.rows[0].name}" và "${t2.rows[0].name}".`);

    // 3. Seed Sample Completed Match with Replay
    const sampleReplay = {
      matchId: 'match_sample_final_01',
      boardSize: 9,
      winner: 1,
      winReason: 'CHECKMATE',
      totalTurns: 12,
      steps: [
        {
          step: 1,
          player: 1,
          move: { fromRow: 0, fromCol: 0, toRow: 1, toCol: 0 },
          boardSnapshot: [
            [{ piece: { type: 'ROCK', player: 1 }, item: null }, { piece: null, item: null }],
            [{ piece: { type: 'SCISSORS', player: 2 }, item: null }, { piece: null, item: null }],
          ],
        },
        {
          step: 2,
          player: 2,
          move: { fromRow: 1, fromCol: 0, toRow: 0, toCol: 0 },
          combat: { attacker: { type: 'SCISSORS' }, defender: { type: 'ROCK' }, outcome: 'LOSE' },
          boardSnapshot: [
            [{ piece: { type: 'ROCK', player: 1 }, item: null }, { piece: null, item: null }],
            [{ piece: null, item: null }, { piece: null, item: null }],
          ],
        },
      ],
    };

    // 3. Ensure a default Map exists
    let mapId = null;
    const mapRes = await query('SELECT id FROM "Maps" LIMIT 1;');
    if (mapRes.rows.length > 0) {
      mapId = mapRes.rows[0].id;
    } else {
      const newMap = await query(
        `INSERT INTO "Maps" (name, size, difficulty, grid_layout_json)
         VALUES ('Sân Đấu Tiêu Chuẩn 9x9', '9x9', 'medium', '{}')
         RETURNING id;`
      );
      mapId = newMap.rows[0].id;
    }

    if (studentRecords.length >= 2 && mapId) {
      await query(
        `INSERT INTO "Matches" (map_id, player1_id, player2_id, player1_bot_id, player2_bot_id, winner_id, win_reason, duration_ms, replay_json)
         VALUES ($1, $2, $3, $4, $5, $6, 'CHECKMATE', 8400, $7);`,
        [
          mapId,
          studentRecords[0].user.id,
          studentRecords[1].user.id,
          studentRecords[0].bot.id,
          studentRecords[1].bot.id,
          studentRecords[0].user.id,
          JSON.stringify(sampleReplay),
        ]
      );
      console.log('✅ Seeded sample match replay with map_id:', mapId);
    }

    console.log('=======================================================');
    console.log('🎉 TOÀN BỘ DỮ LIỆU GIẢI ĐẤU & HỌC SINH ĐÃ ĐƯỢC SEED XONG!');
    console.log('=======================================================');
  } catch (err) {
    console.error('Lỗi seed dữ liệu:', err);
  } finally {
    await pool.end();
  }
}

seedAll();
