const {execFile}=require('child_process');
const {pool}=require('../config/db');
const {getPythonCommand}=require('../game/pythonRunner');
let cached,expires=0,pending;
async function check() {
  if(cached&&Date.now()<expires)return cached;
  if(pending)return pending;
  pending=(async()=>{
    const {redisConnection}=require('../config/redis');
    const [database,python,settings,heartbeat]=await Promise.all([
      pool.query({text:'SELECT 1',query_timeout:3000}).then(()=>true,()=>false),
      new Promise(resolve=>execFile(getPythonCommand(),['-c','import json; print(json.dumps({"ok":True}))'],{timeout:3000},(error)=>resolve(!error))),
      pool.query({text:`SELECT value FROM "SystemSettings" WHERE key='judge'`,query_timeout:3000}).then(r=>r.rows[0]?.value,()=>null),
      redisConnection.status==='ready'?Promise.race([redisConnection.get('battlecode:judge:heartbeat'),new Promise(resolve=>setTimeout(()=>resolve(null),3000))]).catch(()=>null):null,
    ]);
    const paused=Boolean(settings?.paused);
    cached={timestamp:new Date().toISOString(),gateway:'online',database:database?'online':'unavailable',judge:paused?'paused':python?'online':'unavailable',tournamentJudge:heartbeat&&Date.now()-Number(heartbeat)<45000?'online':'unavailable'};
    expires=Date.now()+15000;return cached;
  })().finally(()=>{pending=null;});
  return pending;
}
module.exports={check};
