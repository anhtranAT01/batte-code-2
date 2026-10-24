const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma, query } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_tactical_rps_2026_x892k';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate standard JWT token for authenticated user
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
    }
  );
}

/**
 * Register a new user
 */
async function registerUser({ username, password, role = 'STUDENT' }) {
  // Check if username is already taken
  let existingUser = null;

  if (prisma) {
    try {
      existingUser = await prisma.user.findUnique({
        where: { username },
      });
    } catch {
      // Fallback to raw pg query
      const checkRes = await query('SELECT id FROM "Users" WHERE username = $1 LIMIT 1', [username]);
      existingUser = checkRes.rows[0];
    }
  } else {
    const checkRes = await query('SELECT id FROM "Users" WHERE username = $1 LIMIT 1', [username]);
    existingUser = checkRes.rows[0];
  }

  if (existingUser) {
    const error = new Error('Tên tài khoản này đã được sử dụng. Vui lòng chọn tên khác.');
    error.statusCode = 409;
    throw error;
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  let newUser = null;

  if (prisma) {
    try {
      newUser = await prisma.user.create({
        data: {
          username,
          password_hash: passwordHash,
          role,
          elo_rating: 1200,
        },
        select: {
          id: true,
          username: true,
          role: true,
          elo_rating: true,
          created_at: true,
        },
      });
    } catch {
      const insertSql = `
        INSERT INTO "Users" (username, password_hash, role, elo_rating)
        VALUES ($1, $2, $3, 1200)
        RETURNING id, username, role, elo_rating, created_at;
      `;
      const insertRes = await query(insertSql, [username, passwordHash, role]);
      newUser = insertRes.rows[0];
    }
  } else {
    const insertSql = `
      INSERT INTO "Users" (username, password_hash, role, elo_rating)
      VALUES ($1, $2, $3, 1200)
      RETURNING id, username, role, elo_rating, created_at;
    `;
    const insertRes = await query(insertSql, [username, passwordHash, role]);
    newUser = insertRes.rows[0];
  }

  const token = generateToken(newUser);

  return {
    user: newUser,
    token,
  };
}

/**
 * Login existing user
 */
async function loginUser({ username, password }) {
  let user = null;

  if (prisma) {
    try {
      user = await prisma.user.findUnique({
        where: { username },
      });
    } catch {
      const res = await query('SELECT * FROM "Users" WHERE username = $1 LIMIT 1', [username]);
      user = res.rows[0];
    }
  } else {
    const res = await query('SELECT * FROM "Users" WHERE username = $1 LIMIT 1', [username]);
    user = res.rows[0];
  }

  if (!user) {
    const error = new Error('Tài khoản hoặc mật khẩu không chính xác.');
    error.statusCode = 401;
    throw error;
  }

  // Compare password hash
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    const error = new Error('Tài khoản hoặc mật khẩu không chính xác.');
    error.statusCode = 401;
    throw error;
  }

  const safeUser = {
    id: user.id,
    username: user.username,
    role: user.role,
    elo_rating: user.elo_rating,
    created_at: user.created_at,
  };

  const token = generateToken(safeUser);

  return {
    user: safeUser,
    token,
  };
}

/**
 * Get profile for authenticated user
 */
async function getUserProfile(userId) {
  let user = null;

  if (prisma) {
    try {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          role: true,
          elo_rating: true,
          created_at: true,
          _count: {
            select: {
              bots: true,
              matches_as_p1: true,
              matches_as_p2: true,
              matches_won: true,
            },
          },
        },
      });
    } catch {
      user = null;
    }
  }

  if (!user) {
    const userRes = await query(
      'SELECT id, username, role, elo_rating, created_at FROM "Users" WHERE id = $1 LIMIT 1',
      [userId]
    );
    if (!userRes.rows[0]) {
      const error = new Error('Không tìm thấy thông tin người dùng.');
      error.statusCode = 404;
      throw error;
    }

    const botCountRes = await query(
      'SELECT COUNT(*)::int AS bot_count FROM "Bots" WHERE user_id = $1',
      [userId]
    );

    const matchesCountRes = await query(
      'SELECT COUNT(*)::int AS match_count FROM "Matches" WHERE player1_id = $1 OR player2_id = $1',
      [userId]
    );

    const winsCountRes = await query(
      'SELECT COUNT(*)::int AS win_count FROM "Matches" WHERE winner_id = $1',
      [userId]
    );

    user = {
      ...userRes.rows[0],
      stats: {
        total_bots: botCountRes.rows[0]?.bot_count || 0,
        total_matches: matchesCountRes.rows[0]?.match_count || 0,
        total_wins: winsCountRes.rows[0]?.win_count || 0,
      },
    };
  }

  return user;
}

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  generateToken,
};
