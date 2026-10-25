const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_tactical_rps_2026_x892k';

/**
 * Middleware to authenticate requests via Bearer JWT token
 */
async function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Yêu cầu đăng nhập để truy cập tài nguyên này (Missing Authorization header).',
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      success: false,
      message: 'Định dạng token không hợp lệ (Format: Bearer <token>).',
    });
  }

  const token = parts[1];

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
        code: 'TOKEN_EXPIRED',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Mã xác thực không hợp lệ.',
      code: 'INVALID_TOKEN',
    });
  }
  try {
    const current = await query('SELECT id,username,role,auth_version FROM "Users" WHERE id = $1',[decoded.id]);
    if (!current.rows[0]) return res.status(401).json({success:false,
      code:'ACCOUNT_REMOVED',message:'Tài khoản không còn tồn tại. Vui lòng đăng nhập lại.'});
    if((decoded.authVersion||0)!==(current.rows[0].auth_version||0))return res.status(401).json({success:false,message:'Mật khẩu đã thay đổi. Hãy đăng nhập lại.'});
    req.user = {...decoded,...current.rows[0]};
    next();
  } catch (error) { next(error); }
}

/**
 * Role-based access control guard
 * @param {string[]} allowedRoles
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Yêu cầu đăng nhập trước khi thực hiện thao tác này.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Bạn không có quyền thực hiện thao tác này (Required role: ${allowedRoles.join(', ')}).`,
      });
    }

    next();
  };
}

module.exports = {
  authenticateJWT,
  requireRole,
};
