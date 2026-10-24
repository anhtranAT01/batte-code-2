const { query } = require('../config/db');

async function seedUniversityTournaments() {
  try {
    console.log('🌱 Seeding University Tournaments & Brackets...');

    // Get existing students
    const usersRes = await query('SELECT id, username, elo_rating FROM "Users" WHERE role != \'ADMIN\' LIMIT 8');
    const students = usersRes.rows;

    const brackets8 = [
      {
        id: 'bracket_qf1',
        round: 1,
        matchNumber: 1,
        title: 'Tứ Kết 1',
        p1: students[0] ? { id: students[0].id, name: students[0].username, bot: 'Minimax Alpha-Beta Bot', score: 1 } : { name: 'SV Nguyễn Văn Đức', bot: 'A* Rusher', score: 1 },
        p2: students[1] ? { id: students[1].id, name: students[1].username, bot: 'Flag Rusher Bot', score: 0 } : { name: 'SV Trần Hải Nam', bot: 'Heuristic', score: 0 },
        winner: students[0] ? students[0].username : 'SV Nguyễn Văn Đức',
        status: 'COMPLETED',
      },
      {
        id: 'bracket_qf2',
        round: 1,
        matchNumber: 2,
        title: 'Tứ Kết 2',
        p1: students[2] ? { id: students[2].id, name: students[2].username, bot: 'Combat Hunter', score: 1 } : { name: 'SV Lê Hoàng Minh', bot: 'Minimax', score: 1 },
        p2: students[3] ? { id: students[3].id, name: students[3].username, bot: 'Flag Defender', score: 0 } : { name: 'SV Phạm Thu Hà', bot: 'Defense', score: 0 },
        winner: students[2] ? students[2].username : 'SV Lê Hoàng Minh',
        status: 'COMPLETED',
      },
      {
        id: 'bracket_qf3',
        round: 1,
        matchNumber: 3,
        title: 'Tứ Kết 3',
        p1: students[4] ? { id: students[4].id, name: students[4].username, bot: 'Potion Collector', score: 0 } : { name: 'SV Hoàng Quốc Bảo', bot: 'Potion', score: 0 },
        p2: { name: 'SV Đặng Quỳnh Trang (K22)', bot: 'A* Flag Rusher', score: 1 },
        winner: 'SV Đặng Quỳnh Trang (K22)',
        status: 'COMPLETED',
      },
      {
        id: 'bracket_qf4',
        round: 1,
        matchNumber: 4,
        title: 'Tứ Kết 4',
        p1: { name: 'SV Vũ Tiến Đạt (K21)', bot: 'Minimax Deep', score: 1 },
        p2: { name: 'SV Bùi Gia Hưng (K23)', bot: 'Greedy Rush', score: 0 },
        winner: 'SV Vũ Tiến Đạt (K21)',
        status: 'COMPLETED',
      },
      {
        id: 'bracket_sf1',
        round: 2,
        matchNumber: 5,
        title: 'Bán Kết 1',
        p1: students[0] ? { id: students[0].id, name: students[0].username, bot: 'Minimax Alpha-Beta Bot', score: null } : { name: 'SV Nguyễn Văn Đức', bot: 'A* Rusher', score: null },
        p2: students[2] ? { id: students[2].id, name: students[2].username, bot: 'Combat Hunter', score: null } : { name: 'SV Lê Hoàng Minh', bot: 'Minimax', score: null },
        winner: null,
        status: 'ONGOING',
      },
      {
        id: 'bracket_sf2',
        round: 2,
        matchNumber: 6,
        title: 'Bán Kết 2',
        p1: { name: 'SV Đặng Quỳnh Trang (K22)', bot: 'A* Flag Rusher', score: null },
        p2: { name: 'SV Vũ Tiến Đạt (K21)', bot: 'Minimax Deep', score: null },
        winner: null,
        status: 'PENDING',
      },
      {
        id: 'bracket_fn1',
        round: 3,
        matchNumber: 7,
        title: 'Chung Kết Tranh Cúp',
        p1: { name: 'Thắng Bán Kết 1', bot: 'TBD', score: null },
        p2: { name: 'Thắng Bán Kết 2', bot: 'TBD', score: null },
        winner: null,
        status: 'PENDING',
      },
    ];

    // Clear old sample tournaments
    await query('DELETE FROM "Tournaments"');

    // 1. ALL-IN Tournament 1
    await query(`
      INSERT INTO "Tournaments" (id, name, status, mode, max_participants, scheduled_start_at, brackets_json, settings_json)
      VALUES (
        '11111111-1111-1111-1111-111111111111',
        'Đấu Trường Toàn Thể - Hội Thao Lập Trình AI Sinh Viên Đại Học',
        'ONGOING',
        'ALL_IN',
        1000,
        NOW() + INTERVAL '2 hours',
        '[]'::jsonb,
        $1::jsonb
      )
    `, [JSON.stringify({
      description: 'Chế độ thi đấu mở cho toàn thể sinh viên các Khoa CNTT, AI, Điện Tử. Mọi sinh viên nộp bot sẽ được tự động chấm điểm xếp hạng vòng tròn trên bảng tổng sắp.',
      mode: 'ALL_IN',
      faculty: 'Toàn Trường Đại Học',
      participants: students.map(s => ({
        userId: s.id,
        username: s.username,
        elo: s.elo_rating,
        points: Math.floor(Math.random() * 20) + 10,
        botName: 'Flag Rusher AI',
      })),
    })]);

    // 2. ALL-IN Tournament 2
    await query(`
      INSERT INTO "Tournaments" (id, name, status, mode, max_participants, scheduled_start_at, brackets_json, settings_json)
      VALUES (
        '22222222-2222-2222-2222-222222222222',
        'Giải Thuật Toán AI Toàn Khóa K21 - K22 - K23 (Mở Rộng)',
        'UPCOMING',
        'ALL_IN',
        500,
        NOW() + INTERVAL '1 day',
        '[]'::jsonb,
        $1::jsonb
      )
    `, [JSON.stringify({
      description: 'Đấu trường chấm điểm toàn thể các khóa sinh viên. Tính điểm theo hệ số Elo và điểm cướp cờ.',
      mode: 'ALL_IN',
      faculty: 'Viện Trí Tuệ Nhân Tạo & Data Science',
      participants: students.map(s => ({
        userId: s.id,
        username: s.username,
        elo: s.elo_rating,
        points: 0,
        botName: 'Minimax Bot',
      })),
    })]);

    // 3. BRANCHES Tournament 1 (Khoa CNTT)
    await query(`
      INSERT INTO "Tournaments" (id, name, status, mode, max_participants, scheduled_start_at, brackets_json, settings_json)
      VALUES (
        '33333333-3333-3333-3333-333333333333',
        'Cúp Vô Địch Nhánh Đơn Loại Trực Tiếp - Khoa Công Nghệ Thông Tin',
        'ONGOING',
        'BRANCHES',
        16,
        NOW() + INTERVAL '4 hours',
        $1::jsonb,
        $2::jsonb
      )
    `, [
      JSON.stringify(brackets8),
      JSON.stringify({
        description: 'Giải đấu phân nhánh đấu loại trực tiếp (Single Elimination Bracket) dành riêng cho sinh viên Khoa CNTT. Đấu Tứ kết, Bán kết và Chung kết.',
        mode: 'BRANCHES',
        faculty: 'Khoa Công Nghệ Thông Tin',
        participants: students.map(s => ({
          userId: s.id,
          username: s.username,
          elo: s.elo_rating,
          points: 15,
          botName: 'A* Flag Rusher',
        })),
      }),
    ]);

    // 4. BRANCHES Tournament 2 (Viện AI K21-K22)
    await query(`
      INSERT INTO "Tournaments" (id, name, status, mode, max_participants, scheduled_start_at, brackets_json, settings_json)
      VALUES (
        '44444444-4444-4444-4444-444444444444',
        'Giải Đấu Nhánh K21 & K22 - Viện Trí Tuệ Nhân Tạo (AI Cup)',
        'UPCOMING',
        'BRANCHES',
        32,
        NOW() + INTERVAL '3 days',
        $1::jsonb,
        $2::jsonb
      )
    `, [
      JSON.stringify(brackets8),
      JSON.stringify({
        description: 'Đăng ký vào các nhánh hạt giống tranh Cúp vô địch AI K21-K22. Quản trị viên xếp nhánh theo thành tích nộp bot.',
        mode: 'BRANCHES',
        faculty: 'Viện Trí Tuệ Nhân Tạo',
        participants: [],
      }),
    ]);

    console.log('✅ SEED THÀNH CÔNG 4 GIẢI ĐẤU ĐẠI HỌC VỚI 2 CHẾ ĐỘ: THI TẤT CẢ & NHÁNH ĐẤU RIÊNG LẺ!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding tournaments:', err);
    process.exit(1);
  }
}

seedUniversityTournaments();
