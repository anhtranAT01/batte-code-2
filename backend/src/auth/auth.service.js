const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {createHash,timingSafeEqual} = require('crypto');
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
      authVersion:user.auth_version||0,
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
async function registerUser({username,password,role='STUDENT',adminRegistrationSecret,studentId,teamName,email,consent}) {
  if(role==='ADMIN'||role==='TEACHER') {
    const configured=role==='ADMIN'?process.env.ADMIN_REGISTRATION_SECRET:process.env.TEACHER_REGISTRATION_SECRET;
    const digest=value=>createHash('sha256').update(value).digest();
    if(!configured||typeof adminRegistrationSecret!=='string'||!timingSafeEqual(digest(configured),digest(adminRegistrationSecret)))
      throw Object.assign(new Error('Mã cấp quyền không hợp lệ hoặc đăng ký vai trò này chưa được bật.'),{statusCode:403});
  }
  const passwordHash=await bcrypt.hash(password,10);
  try {
    const result=await query(`INSERT INTO "Users" (username,password_hash,role,elo_rating,student_id,team_name,email,consent_at)
      VALUES ($1,$2,$3,1200,$4,$5,$6,CASE WHEN $7 THEN NOW() ELSE NULL END)
      RETURNING id,username,role,elo_rating,created_at,student_id,team_name,email`,[username,passwordHash,role,studentId||null,teamName||null,email?.trim().toLowerCase()||null,Boolean(consent)]);
    const user=result.rows[0];return {user,token:generateToken(user)};
  } catch(error) {
    if(error.code==='23505')throw Object.assign(new Error('Tên đăng nhập, mã sinh viên hoặc email đã được sử dụng.'),{statusCode:409});
    throw error;
  }
}

/**
 * Login existing user
 */
async function loginUser({ username, password }) {
  const user=(await query('SELECT * FROM "Users" WHERE username=$1 OR student_id=$1 OR lower(email)=lower($1) LIMIT 1',[username])).rows[0];

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
    team_name: user.team_name || null,
    elo_rating: user.elo_rating,
    created_at: user.created_at,
    auth_version:user.auth_version||0,
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
          team_name: true,
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
      'SELECT id, username, role, team_name, student_id, elo_rating, created_at FROM "Users" WHERE id = $1 LIMIT 1',
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
