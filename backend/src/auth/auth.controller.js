const authService = require('./auth.service');
const { registerSchema, loginSchema } = require('./auth.validation');

/**
 * Handle student/user registration
 */
async function register(req, res, next) {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMessages = parseResult.error.errors.map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu đăng ký không hợp lệ',
        errors: errorMessages,
      });
    }

    const { username, password, role } = parseResult.data;
    const result = await authService.registerUser({ username, password, role });

    return res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công!',
      data: result,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
}

/**
 * Handle user login
 */
async function login(req, res, next) {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMessages = parseResult.error.errors.map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu đăng nhập không hợp lệ',
        errors: errorMessages,
      });
    }

    const { username, password } = parseResult.data;
    const result = await authService.loginUser({ username, password });

    return res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công!',
      data: result,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
}

/**
 * Get profile of current authenticated user
 */
async function getMe(req, res, next) {
  try {
    const user = await authService.getUserProfile(req.user.id);
    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
}

module.exports = {
  register,
  login,
  getMe,
};
