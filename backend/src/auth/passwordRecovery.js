const express=require('express');
const {createHash,randomBytes}=require('crypto');
const bcrypt=require('bcryptjs');
const {query,pool}=require('../config/db');
const {z}=require('zod');
const router=express.Router();
const digest=value=>createHash('sha256').update(value).digest('hex');
const safeMessage='Nếu email đã đăng ký, hướng dẫn khôi phục sẽ được gửi. Kiểm tra cả thư rác.';
router.get('/recovery-status',(req,res)=>res.json({available:Boolean(process.env.SMTP_HOST&&process.env.SMTP_FROM&&process.env.PASSWORD_RESET_URL)}));
router.post('/forgot-password',async(req,res,next)=>{
  try{
    const parsed=z.string().trim().toLowerCase().email().max(254).safeParse(req.body.email);
    if(!parsed.success)return res.status(400).json({message:'Email không hợp lệ.'});
    if(!process.env.SMTP_HOST||!process.env.SMTP_FROM||!process.env.PASSWORD_RESET_URL)return res.status(503).json({message:'Chưa bật gửi email khôi phục. Hãy liên hệ Admin trong Hỏi đáp.'});
    const user=(await query('SELECT id,email FROM "Users" WHERE lower(email)=$1',[parsed.data])).rows[0];
    if(user){
      const token=randomBytes(32).toString('hex');
      const inserted=await query(`INSERT INTO "PasswordResets" (token_hash,user_id,expires_at)
        SELECT $1,$2,NOW()+INTERVAL '15 minutes' WHERE NOT EXISTS (SELECT 1 FROM "PasswordResets" WHERE user_id=$2 AND created_at>NOW()-INTERVAL '1 minute') RETURNING token_hash`,[digest(token),user.id]);
      if(inserted.rows.length){
        try{
          const transport=require('nodemailer').createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==='true',auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}:undefined,connectionTimeout:5000,socketTimeout:8000});
          const url=new URL(process.env.PASSWORD_RESET_URL);url.hash=new URLSearchParams({reset_token:token}).toString();
          await transport.sendMail({from:process.env.SMTP_FROM,to:user.email,subject:'Khôi phục mật khẩu BattleCode',text:`Liên kết dùng một lần, hết hạn sau 15 phút: ${url.toString()}\nNếu không yêu cầu, bạn có thể bỏ qua thư này.`});
        }catch{await query('DELETE FROM "PasswordResets" WHERE token_hash=$1',[digest(token)]);return res.status(503).json({message:'Chưa gửi được email. Hãy thử lại hoặc liên hệ Admin.'});}
      }
    }
    res.json({success:true,message:safeMessage});
  }catch(error){next(error);}
});
router.post('/reset-password',async(req,res,next)=>{
  const parsed=z.object({token:z.string().regex(/^[a-f0-9]{64}$/),password:z.string().min(6).max(100)}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({message:'Liên kết hoặc mật khẩu không hợp lệ.'});
  let client;
  try{
    const hashed=await bcrypt.hash(parsed.data.password,10);
    client=await pool.connect();await client.query('BEGIN');
    const reset=(await client.query('SELECT user_id FROM "PasswordResets" WHERE token_hash=$1 AND expires_at>NOW() FOR UPDATE',[digest(parsed.data.token)])).rows[0];
    if(!reset){await client.query('ROLLBACK');return res.status(400).json({message:'Liên kết đã hết hạn hoặc đã sử dụng.'});}
    await client.query('UPDATE "Users" SET password_hash=$1,auth_version=auth_version+1,updated_at=NOW() WHERE id=$2',[hashed,reset.user_id]);
    await client.query('DELETE FROM "PasswordResets" WHERE user_id=$1',[reset.user_id]);await client.query('COMMIT');
    res.json({success:true,message:'Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới.'});
  }catch(error){if(client)await client.query('ROLLBACK');next(error);}finally{client?.release();}
});
module.exports=router;
