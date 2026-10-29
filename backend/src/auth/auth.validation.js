const { z } = require('zod');

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, { message: 'Username must be at least 3 characters long' })
    .max(30, { message: 'Username cannot exceed 30 characters' })
    .regex(/^[a-zA-Z0-9_]+$/, {
      message: 'Username can only contain alphanumeric characters and underscores',
    }),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters long' })
    .max(100, { message: 'Password cannot exceed 100 characters' }),
  role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']).optional().default('STUDENT'),
  adminRegistrationSecret: z.string().max(256).optional(),
  studentId:z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  teamName:z.string().trim().min(2).max(100),
  email:z.string().trim().toLowerCase().email({message:'Email không đúng định dạng. Vui lòng kiểm tra lại email, tài khoản và mật khẩu.'}).max(254),
  consent:z.literal(true,{errorMap:()=>({message:'Bạn cần đồng ý quy chế và việc xử lý dữ liệu để đăng ký.'})}),
});

const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, { message: 'Username is required' }),
  password: z
    .string()
    .min(1, { message: 'Password is required' }),
});

module.exports = {
  registerSchema,
  loginSchema,
};
