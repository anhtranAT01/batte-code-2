const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { query, pool } = require('../config/db');
const { registerSchema } = require('../auth/auth.validation');

const userIdSchema = z.string().uuid();
const usernameSchema = registerSchema.shape.username;
const roleSchema = z.enum(['STUDENT', 'TEACHER', 'ADMIN']);
const passwordSchema = z.string().min(8).max(72)
  .refine(value => Buffer.byteLength(value, 'utf8') <= 72);

function fail(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parse(schema, value, message) {
  const result = schema.safeParse(value);
  if (!result.success) throw fail(400, message);
  return result.data;
}

function validateId(id) {
  return parse(userIdSchema, id, 'Mã tài khoản không hợp lệ.');
}

// Recheck current database permissions: an old ADMIN token cannot retain
// account-management access after another administrator changes its role.
async function requireCurrentAdmin(req, res, next) {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Chỉ Admin được quản lý tài khoản và mật khẩu.' });
    }
    const result = await query('SELECT role FROM "Users" WHERE id = $1', [req.user.id]);
    if (result.rows[0]?.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Tài khoản không còn quyền quản trị. Vui lòng đăng nhập lại.' });
    }
    next();
  } catch (error) {
    next(error);
  }
}

async function renameUser(id, username) {
  validateId(id);
  const name = parse(usernameSchema, username, 'Tên tài khoản phải dài 3–30 ký tự, chỉ gồm chữ, số và dấu gạch dưới.');
  try {
    const result = await query(
      'UPDATE "Users" SET username = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, role, elo_rating, created_at',
      [name, id]
    );
    if (!result.rows[0]) throw fail(404, 'Không tìm thấy người dùng.');
    return result.rows[0];
  } catch (error) {
    if (error.code === '23505') throw fail(409, 'Tên tài khoản này đã được sử dụng.');
    throw error;
  }
}

async function resetPassword(id, password) {
  validateId(id);
  const newPassword = parse(passwordSchema, password, 'Mật khẩu mới phải dài ít nhất 8 ký tự và tối đa 72 byte.');
  const hash = await bcrypt.hash(newPassword, 10);
  const result = await query(
    'UPDATE "Users" SET password_hash = $1, auth_version=auth_version+1, updated_at = NOW() WHERE id = $2 RETURNING id, username',
    [hash, id]
  );
  if (!result.rows[0]) throw fail(404, 'Không tìm thấy người dùng.');
  return result.rows[0];
}

async function changeRole(actorId, id, role) {
  validateId(id);
  const nextRole = parse(roleSchema, role, 'Quyền không hợp lệ.');
  if (actorId === id && nextRole !== 'ADMIN') {
    throw fail(400, 'Bạn không thể tự gỡ quyền Admin của mình.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize role changes so two admins cannot concurrently remove each
    // other's access and leave the installation without an administrator.
    await client.query('SELECT pg_advisory_xact_lock(87292103)');
    const actor = await client.query('SELECT role FROM "Users" WHERE id = $1', [actorId]);
    if (actor.rows[0]?.role !== 'ADMIN') throw fail(403, 'Chỉ Admin được đổi quyền tài khoản.');
    const target = await client.query('SELECT id, role FROM "Users" WHERE id = $1 FOR UPDATE', [id]);
    if (!target.rows[0]) throw fail(404, 'Không tìm thấy người dùng.');
    if (target.rows[0].role === 'ADMIN' && nextRole !== 'ADMIN') {
      const admins = await client.query('SELECT COUNT(*)::INT AS count FROM "Users" WHERE role = \'ADMIN\'');
      if (admins.rows[0].count <= 1) throw fail(400, 'Hệ thống phải còn ít nhất một Admin.');
    }
    const result = await client.query(
      'UPDATE "Users" SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, role',
      [nextRole, id]
    );
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { requireCurrentAdmin, renameUser, resetPassword, changeRole };
