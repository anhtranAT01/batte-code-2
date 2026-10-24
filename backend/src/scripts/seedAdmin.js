/**
 * Script to seed or reset the default System Administrator account
 */

const bcrypt = require('bcryptjs');
const { query, pool } = require('../config/db');

async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const role = 'ADMIN';
  const eloRating = 2000;

  console.log(`[Seed Admin] Creating or updating administrator account "${username}"...`);

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const sql = `
      INSERT INTO "Users" (username, password_hash, role, elo_rating)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (username) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          elo_rating = EXCLUDED.elo_rating
      RETURNING id, username, role, elo_rating, created_at;
    `;

    const res = await query(sql, [username, passwordHash, role, eloRating]);
    const user = res.rows[0];

    console.log('=======================================================');
    console.log('✅ TÀI KHOẢN ADMIN HỆ THỐNG ĐÃ ĐƯỢC THIẾT LẬP THÀNH CÔNG');
    console.log('=======================================================');
    console.log(`- Tên đăng nhập (Username): ${user.username}`);
    console.log(`- Mật khẩu mặc định       : ${password}`);
    console.log(`- Quyền hạn (Role)        : ${user.role}`);
    console.log(`- Hệ số Elo khởi đầu      : ${user.elo_rating}`);
    console.log(`- ID tài khoản            : ${user.id}`);
    console.log('=======================================================');
  } catch (err) {
    console.error('❌ Lỗi khi khởi tạo tài khoản admin:', err.message);
  } finally {
    await pool.end();
  }
}

seedAdmin();
