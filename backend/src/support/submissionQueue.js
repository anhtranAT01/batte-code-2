const {Worker}=require('worker_threads');
const path=require('path');
const {query}=require('../config/db');
const {createCodeBot}=require('../bot/bot.service');
let busy=false,running=false,timer,worker;
const state={checkedAt:null,available:null,paused:false};
function validate(source) {
  return new Promise((resolve,reject)=>{
    worker=new Worker(path.join(__dirname,'validate.worker.js'),{workerData:{source}});
    const current=worker;
    const timeout=setTimeout(()=>{current.terminate();reject(new Error('Máy chấm chưa phản hồi. Bài sẽ được thử lại.'));},15000);
    current.once('message',result=>{clearTimeout(timeout);result.ok?resolve():reject(Object.assign(new Error(result.message),{statusCode:result.statusCode}));});
    current.once('error',error=>{clearTimeout(timeout);reject(error);});
    current.once('exit',code=>{clearTimeout(timeout);if(code!==0)reject(new Error('Máy chấm đã khởi động lại.'));if(worker===current)worker=null;});
  });
}
async function tick() {
  if(busy)return false;busy=true;
  try {
    const settings=(await query(`SELECT value FROM "SystemSettings" WHERE key='judge'`)).rows[0]?.value;
    state.paused=Boolean(settings?.paused);
    if(state.paused)return false;
    // Atomic lease permits multiple API instances, including recovery after a crash.
    const job=(await query(`UPDATE "Submissions" SET status='processing',locked_until=NOW()+INTERVAL '45 seconds',attempts=attempts+1
      WHERE id=(SELECT id FROM "Submissions" WHERE (status='pending' AND retry_at<=NOW()) OR (status='processing' AND locked_until<NOW())
      ORDER BY received_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`)).rows[0];
    if(!job)return false;
    try {
      const existing=(await query('SELECT id FROM "Bots" WHERE id=$1 AND user_id=$2',[job.bot_id,job.user_id])).rows[0];
      if(!existing){
        await validate(job.source);state.available=true;state.checkedAt=new Date().toISOString();
        await createCodeBot({userId:job.user_id,botName:job.name,code:job.source.replace(/^\uFEFF/,''),botId:job.bot_id,validated:true});
      }
      await query(`UPDATE "Submissions" SET status='accepted',completed_at=NOW(),locked_until=NULL,message='Đã kiểm tra và thêm vào Kho bot.' WHERE id=$1`,[job.id]);
    } catch(error) {
      const invalid=[400,422].includes(error.statusCode);
      state.available=invalid?true:false;state.checkedAt=new Date().toISOString();
      await query(`UPDATE "Submissions" SET status=$2,message=$3,locked_until=NULL,retry_at=NOW()+($4*INTERVAL '1 second'),completed_at=CASE WHEN $2='rejected' THEN NOW() ELSE NULL END WHERE id=$1`,
        [job.id,invalid?'rejected':'pending',invalid?error.message:'Máy chấm tạm gián đoạn; bài vẫn được lưu và sẽ thử lại.',Math.min(60,2**Math.min(job.attempts,6))]);
    }
    return true;
  } catch(error) {console.error('[Submission queue]',error.message);return false;}
  finally{busy=false;}
}
async function poll(){
  if(!running)return;
  const processed=await tick();
  // Drain ready work immediately. Idle, paused and unavailable queues still back off.
  if(running){timer=setTimeout(poll,processed?0:2000);timer.unref();}
}
function start(){if(running)return;running=true;poll();}
function stop(){running=false;clearTimeout(timer);worker?.terminate();}
module.exports={start,stop,tick,state};
