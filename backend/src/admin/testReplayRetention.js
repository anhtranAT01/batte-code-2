// Real SQL in an isolated in-memory PostgreSQL. Never reads/writes a live database.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const redisPath=require.resolve('../config/redis');
require.cache[redisPath]={id:redisPath,filename:redisPath,loaded:true,exports:{matchQueue:{},redisConnection:{}}};
async function main(){
  if(!process.env.TEST_PGLITE_MODULE)throw new Error('Set TEST_PGLITE_MODULE; this test never uses DATABASE_URL.');
  const {PGlite}=require(process.env.TEST_PGLITE_MODULE),db=new PGlite();
  const sql=async(text,args=[])=>args.length?db.query(text,args):(await db.exec(text)).at(-1)||{rows:[]};
  const pg=require('../config/db');pg.query=sql;pg.pool.connect=async()=>({query:sql,release(){}});
  let server;
  try{
    await db.exec(fs.readFileSync(path.join(__dirname,'../../init.sql'),'utf8').split('-- Seed default System Administrator account')[0].replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";','').replaceAll('uuid_generate_v4()','gen_random_uuid()'));
    await db.exec(fs.readFileSync(path.join(__dirname,'../scripts/resilience.sql'),'utf8'));
    await db.exec('ALTER TABLE "Bots" ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false');
    const migration=fs.readFileSync(path.join(__dirname,'../scripts/replayRetention.sql'),'utf8');
    await db.exec(migration);await db.exec(migration);
    const admin=randomUUID(),student=randomUUID(),teacher=randomUUID(),completed=randomUUID(),ongoing=randomUUID(),upcoming=randomUUID();
    for(const [id,role] of [[admin,'ADMIN'],[student,'STUDENT'],[teacher,'TEACHER']])await sql('INSERT INTO "Users"(id,username,password_hash,role)VALUES($1,$2,\'test\',$3)',[id,role,role]);
    for(const [id,status] of [[completed,'COMPLETED'],[ongoing,'ONGOING'],[upcoming,'UPCOMING']])await sql('INSERT INTO "Tournaments"(id,name,status,settings_json)VALUES($1,\'Fixture\',$2,$3)',[id,status,JSON.stringify({participants:[{userId:student,username:'STUDENT',elo:1200,points:0}]})]);
    const heavy={mode:'PRACTICE',p1Name:'STUDENT',p2Name:'Boss fixture',winner:2,steps:Array.from({length:200},(_,i)=>({step:i+1,boardSnapshot:Array.from({length:9},()=>Array.from({length:9},()=>({type:'ROCK',player:1})))})),initialBoard:[[1]],mapConfig:{size:9}};
    const add=async({age=30,judgeAge=age,reason='FLAG_CAPTURE',tournament=null,replay=heavy}={})=>{
      const id=randomUUID();await sql(`INSERT INTO "Matches"(id,player1_id,map_id,win_reason,replay_json,created_at,judged_at,tournament_id,duration_ms)
        VALUES($1,$2,(SELECT id FROM "Maps" LIMIT 1),$3,$4,NOW()-($5*INTERVAL '1 day'),NOW()-($6*INTERVAL '1 day'),$7,100)`,[id,student,reason,JSON.stringify(replay),age,judgeAge,tournament]);return id;
    };
    const old=await add(),legacy=await add({tournament:completed,replay:[{step:1},{step:2},{step:3}],reason:'DRAW'});
    const protectedIds=[await add({age:1}),await add({reason:null}),await add({tournament:ongoing}),await add({tournament:upcoming}),await add({age:30,judgeAge:1})];
    const retention=require('./replayRetention'),service=require('../game/gameService');
    const tournament=require('../tournament/tournament.service');
    const before=await tournament.getTournamentStandings(completed);
    const identities=(await sql('SELECT id,winner_id,win_reason,p1_elo_change,p2_elo_change FROM "Matches" ORDER BY id')).rows;
    const sizeBefore=Number((await sql('SELECT sum(pg_column_size(replay_json)) AS bytes FROM "Matches"')).rows[0].bytes);
    assert.equal((await retention.getSettings()).days,0);
    assert.deepEqual(await retention.cleanupBatch(),{removed:0,enabled:false});
    for(const value of [-1,1.5,3651,'7',null])await assert.rejects(retention.saveSettings(value),error=>error.statusCode===400);
    await retention.saveSettings(7);
    assert.equal((await retention.cleanupBatch()).removed,2);
    const rows=(await sql('SELECT id,replay_json,replay_expired_at FROM "Matches"')).rows;
    assert.ok(rows.find(row=>row.id===old).replay_expired_at);
    assert.equal(rows.find(row=>row.id===old).replay_json.winner,2);
    assert.equal(rows.find(row=>row.id===old).replay_json.p2Name,'Boss fixture');
    assert.equal(rows.find(row=>row.id===old).replay_json.totalTurns,200);
    assert.ok(!('steps' in rows.find(row=>row.id===old).replay_json));
    assert.equal(rows.find(row=>row.id===legacy).replay_json.totalTurns,3);
    for(const id of protectedIds)assert.equal(rows.find(row=>row.id===id).replay_expired_at,null);
    assert.deepEqual((await sql('SELECT id,winner_id,win_reason,p1_elo_change,p2_elo_change FROM "Matches" ORDER BY id')).rows,identities);
    assert.deepEqual(await tournament.getTournamentStandings(completed),before,'Standings must remain identical after replay cleanup');
    await assert.rejects(service.getReplay(old),error=>error.statusCode===410);
    assert.equal((await service.getRecentMatches(100)).find(row=>row.id===old).winner_side,2);
    assert.equal((await retention.cleanupBatch()).removed,0);
    for(let i=0;i<205;i++)await add({replay:[{step:1}]});
    assert.equal((await retention.cleanupBatch()).removed,100);
    assert.equal((await retention.cleanupBatch()).removed,100);
    assert.equal((await retention.cleanupBatch()).removed,5);
    await retention.saveSettings(0);await add({replay:[{step:1}]});
    assert.equal((await retention.cleanupBatch()).removed,0);

    const express=require('express'),jwt=require('jsonwebtoken'),app=express();app.use(express.json());
    app.use('/api/admin',require('./admin.routes'));
    app.get('/replay/:matchId',require('../game/gameController').getReplay);
    app.use((error,req,res,next)=>res.status(error.statusCode||500).json({success:false,message:error.message}));
    server=await new Promise(resolve=>{const listener=app.listen(0,'127.0.0.1',()=>resolve(listener));});
    const base=`http://127.0.0.1:${server.address().port}`;
    const request=async(id,role,method='GET',body)=>fetch(`${base}/api/admin/replay-retention`,{method,headers:{Authorization:`Bearer ${jwt.sign({id,role,auth_version:0},process.env.JWT_SECRET||'super_secret_jwt_key_tactical_rps_2026_x892k')}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    assert.equal((await fetch(`${base}/api/admin/replay-retention`)).status,401);
    assert.equal((await request(student,'STUDENT')).status,403);
    assert.equal((await request(teacher,'TEACHER')).status,403);
    assert.equal((await request(admin,'ADMIN','PUT',{days:'7'})).status,400);
    assert.equal((await request(admin,'ADMIN','PUT',{days:14})).status,200);
    assert.equal((await (await request(admin,'ADMIN')).json()).data.days,14);
    await sql('UPDATE "Users" SET role=\'STUDENT\' WHERE id=$1',[admin]);
    assert.equal((await request(admin,'ADMIN','PUT',{days:7})).status,403);
    const expiredResponse=await fetch(`${base}/replay/${old}`);assert.equal(expiredResponse.status,410);
    const http=require('node:http');
    const response=await new Promise((resolve,reject)=>{http.get(`${base}/replay/${protectedIds[0]}`,{headers:{'Accept-Encoding':'gzip'}},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({headers:res.headers,bytes:Buffer.concat(chunks)}));}).on('error',reject);});
    assert.equal(response.headers['content-encoding'],'gzip');
    const unpacked=require('node:zlib').gunzipSync(response.bytes);
    assert.equal(JSON.parse(unpacked).data.steps.length,200);
    assert.ok(response.bytes.length < unpacked.length/2);
    const practice=await service.createPracticeMatch({});
    assert.equal((await service.getReplay(practice.matchId)).matchId,practice.matchId);
    const realNow=Date.now;
    try {Date.now=()=>realNow()+60*60_000+1;assert.equal(await service.getReplay(practice.matchId),null,'Abandoned practice sessions leave RAM');}
    finally {Date.now=realNow;}
    console.log(`PASS: idempotent migration; disabled policy; validation and current-admin permissions; age/completion protections; bounded batches; metadata/standings preserved; 410 expired replay; gzip ${unpacked.length} -> ${response.bytes.length} bytes. Initial replay storage ${sizeBefore} bytes.`);
  }finally{if(server)await new Promise(resolve=>server.close(resolve));await db.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
