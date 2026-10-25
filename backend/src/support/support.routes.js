const express = require('express');
const {randomUUID,createHash} = require('crypto');
const {query} = require('../config/db');
const {authenticateJWT,requireRole} = require('../auth/auth.middleware');
const {z} = require('zod');
const router = express.Router();
const uuid = z.string().uuid();
const submission = z.object({id:uuid,name:z.string().trim().min(1).max(100),source:z.string().min(1).max(2*1024*1024)});
const question = z.object({id:uuid,category:z.enum(['rules','technical','schedule','incident']),question:z.string().trim().min(5).max(4000)});
const wrap = fn => (req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
const parse = (schema,data)=>{const result=schema.safeParse(data);if(!result.success) throw Object.assign(new Error('Dữ liệu không hợp lệ: '+result.error.issues.map(x=>x.message).join(', ')),{statusCode:400});return result.data;};
const receiptFields = 'id,name,bot_id,status,attempts,message,received_at,completed_at';

router.get('/questions/public',wrap(async(req,res)=>{
  // Public projection deliberately excludes author, student ID, email and staff identity.
  const result=await query(`SELECT id,category,question,answer,answered_at FROM "Questions" WHERE is_public AND answer IS NOT NULL ORDER BY answered_at DESC LIMIT 100`);
  res.json({success:true,data:result.rows});
}));
router.use(authenticateJWT);
router.get('/submissions',wrap(async(req,res)=>{
  res.json({success:true,data:(await query(`SELECT ${receiptFields} FROM "Submissions" WHERE user_id=$1 ORDER BY received_at DESC LIMIT 100`,[req.user.id])).rows});
}));
router.post('/submissions',wrap(async(req,res)=>{
  const data=parse(submission,req.body);
  if(Buffer.byteLength(data.source,'utf8')>2*1024*1024) return res.status(413).json({message:'File Python tối đa 2 MB.'});
  const fingerprint=createHash('sha256').update(JSON.stringify([data.name,data.source])).digest('hex');
  const result=await query(`INSERT INTO "Submissions" (id,user_id,name,source,fingerprint,bot_id)
    SELECT $1,$2,$3,$4,$5,$6 WHERE (SELECT count(*) FROM "Submissions" WHERE user_id=$2 AND status IN ('pending','processing'))<20
    ON CONFLICT(id) DO NOTHING RETURNING ${receiptFields}`,[data.id,req.user.id,data.name,data.source,fingerprint,randomUUID()]);
  if(result.rows[0]) return res.status(202).json({success:true,data:result.rows[0]});
  const existing=(await query(`SELECT ${receiptFields},fingerprint,user_id FROM "Submissions" WHERE id=$1`,[data.id])).rows[0];
  if(!existing) return res.status(429).json({message:'Bạn đang có 20 bài chờ chấm. Hãy đợi máy chấm xử lý.'});
  if(existing.user_id!==req.user.id || existing.fingerprint!==fingerprint) return res.status(409).json({message:'Mã nộp đã dùng cho nội dung khác. Hãy tạo bài nộp mới.'});
  delete existing.fingerprint; delete existing.user_id;
  res.json({success:true,data:existing});
}));
router.get('/questions',wrap(async(req,res)=>{
  const staff=['ADMIN','TEACHER'].includes(req.user.role);
  const result=await query(`SELECT q.*,u.username FROM "Questions" q JOIN "Users" u ON u.id=q.user_id
    WHERE ($1::boolean OR q.user_id=$2) ORDER BY q.created_at DESC LIMIT 100`,[staff,req.user.id]);
  res.json({success:true,data:result.rows});
}));
router.post('/questions',wrap(async(req,res)=>{
  const data=parse(question,req.body);
  const result=await query(`INSERT INTO "Questions" (id,user_id,category,question)
    SELECT $1,$2,$3,$4 WHERE (SELECT count(*) FROM "Questions" WHERE user_id=$2 AND created_at>NOW()-INTERVAL '1 hour')<20
    ON CONFLICT(id) DO NOTHING RETURNING id`,[data.id,req.user.id,data.category,data.question]);
  if(!result.rows[0]) {
    const existing=(await query('SELECT user_id,question,category FROM "Questions" WHERE id=$1',[data.id])).rows[0];
    if(!existing) return res.status(429).json({message:'Tối đa 20 câu hỏi mỗi giờ.'});
    if(existing.user_id!==req.user.id||existing.question!==data.question||existing.category!==data.category) return res.status(409).json({message:'Mã câu hỏi đã được sử dụng.'});
  }
  res.status(201).json({success:true,data:{id:data.id},message:'Ban tổ chức đã nhận câu hỏi.'});
}));
router.patch('/questions/:id',requireRole('ADMIN','TEACHER'),wrap(async(req,res)=>{
  parse(uuid,req.params.id);
  const data=parse(z.object({answer:z.string().trim().min(1).max(8000),isPublic:z.boolean()}),req.body);
  const result=await query(`UPDATE "Questions" SET answer=$1,is_public=$2,answered_by=$3,answered_at=NOW() WHERE id=$4 RETURNING id`,[data.answer,data.isPublic,req.user.id,req.params.id]);
  if(!result.rows[0]) return res.status(404).json({message:'Không tìm thấy câu hỏi.'});
  res.json({success:true});
}));
router.patch('/judge',requireRole('ADMIN'),wrap(async(req,res)=>{
  const data=parse(z.object({paused:z.boolean()}),req.body);
  await query(`INSERT INTO "SystemSettings" (key,value) VALUES ('judge',$1) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value`,[JSON.stringify(data)]);
  res.json({success:true,data});
}));
module.exports=router;
