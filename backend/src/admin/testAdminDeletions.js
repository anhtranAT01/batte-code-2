const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const adminId='abcdefab-cdef-4abc-8abc-abcdefabcdef';
const studentId='22222222-2222-4222-8222-222222222222';
const teacherId='33333333-3333-4333-8333-333333333333';
const otherAdmin='44444444-4444-4444-8444-444444444444';
const matchId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const missingId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const users=new Map([
  [adminId,{id:adminId,username:'Admin',role:'ADMIN',elo_rating:1500}],
  [studentId,{id:studentId,username:'Student',role:'STUDENT',elo_rating:1200}],
  [teacherId,{id:teacherId,username:'Teacher',role:'TEACHER',elo_rating:1300}],
  [otherAdmin,{id:otherAdmin,username:'OtherAdmin',role:'ADMIN',elo_rating:1400}],
]);
const matches=new Map([[matchId,{id:matchId,player1_id:studentId,player2_id:teacherId,
  p1_username:'Student',p2_username:'Teacher',winner_id:studentId,win_reason:'FLAG_CAPTURE',
  replay_json:{mode:'PVP',winner:1}}]]);
let bots=[{user_id:studentId}],participants=[{userId:studentId},{id:teacherId}],snapshot;
let failDelete=false,forcedAdminCount,revokedActor=false,invalidations=0;
const forgotten=[],statements=[];
const query=async (sql,args=[]) => {
  statements.push({sql,args});
  if (sql === 'BEGIN') {
    snapshot=structuredClone({users:[...users],matches:[...matches],bots,participants});
  }
  if (sql === 'ROLLBACK' && snapshot) {
    users.clear();for(const [id,u] of snapshot.users) users.set(id,u);
    matches.clear();for(const [id,m] of snapshot.matches) matches.set(id,m);
    bots=snapshot.bots;participants=snapshot.participants;
  }
  if (sql.startsWith('SELECT id,username,role') || sql.startsWith('SELECT role')) {
    const row=users.get(args[0]);
    return {rows:row ? [revokedActor && sql==='SELECT role FROM "Users" WHERE id = $1' ? {...row,role:'STUDENT'} : {...row}] : []};
  }
  if (sql.includes('COUNT(*)::INT')) return {rows:[{count:forcedAdminCount ?? [...users.values()].filter(u=>u.role==='ADMIN').length}]};
  if (sql.startsWith('UPDATE "Tournaments"')) {
    participants=participants.filter(p=>p.userId!==args[0] && p.id!==args[0]);
  }
  if (sql.startsWith('DELETE FROM "Users"')) {
    if (failDelete) throw Error('Simulated database failure');
    users.delete(args[0]);bots=bots.filter(b=>b.user_id!==args[0]);
    for(const [id,m] of matches) if(m.player1_id===args[0] || m.player2_id===args[0]) matches.delete(id);
  }
  if (sql.startsWith('DELETE FROM "Matches"')) {
    const existed=matches.delete(args[0]);return {rows:existed ? [{id:args[0]}] : []};
  }
  if (sql.includes('FROM (SELECT * FROM "Matches"')) return {rows:[...matches.values()].slice(args[1],args[1]+args[0])};
  return {rows:[]};
};
const client={query,release(){}};
function stub(name,exports) {
  const filename=require.resolve(name);require.cache[filename]={id:filename,filename,loaded:true,exports};
}
stub('../config/db',{query,pool:{connect:async()=>client}});
stub('../config/redis',{matchQueue:{}});
stub('../tournament/tournament.service',{});
stub('../game/gameService',{forgetDeletedData:entry=>forgotten.push(entry)});
stub('../game/arenaReads',{invalidateArenaReads:()=>{invalidations++;}});
const app=express();app.use(express.json());app.use('/api/admin',require('./admin.routes'));
app.get('/private',require('../auth/auth.middleware').authenticateJWT,(req,res)=>res.json({role:req.user.role}));
app.use((error,req,res,next)=>res.status(error.statusCode||500).json({message:error.message}));

async function main() {
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const tokens={};
  function token(id,role='ADMIN') {
    return tokens[`${id}:${role}`] ||= jwt.sign({id,role},process.env.JWT_SECRET||'super_secret_jwt_key_tactical_rps_2026_x892k');
  }
  async function request(route,{id=adminId,role='ADMIN',method='DELETE'}={}) {
    const response=await fetch(base+route,{method,headers:id ? {Authorization:`Bearer ${token(id,role)}`} : {}});
    return {status:response.status,...await response.json()};
  }
  try {
    for(const route of [`/api/admin/users/${studentId}`,`/api/admin/matches/${matchId}`]) {
      assert.equal((await request(route,{id:null})).status,401);
      assert.equal((await request(route,{id:teacherId,role:'TEACHER'})).status,403);
      assert.equal((await request(route,{id:teacherId,role:'ADMIN'})).status,403);
    }
    assert.equal((await request('/api/admin/matches',{id:teacherId,role:'TEACHER',method:'GET'})).status,403);
    assert.equal((await request('/api/admin/users/invalid')).status,400);
    assert.equal((await request(`/api/admin/users/${adminId}`)).status,400);
    assert.equal((await request(`/api/admin/users/${adminId.toUpperCase()}`)).status,400);
    assert.equal((await request(`/api/admin/users/${missingId}`)).status,404);
    forcedAdminCount=1;
    assert.equal((await request(`/api/admin/users/${otherAdmin}`)).status,400);
    forcedAdminCount=undefined;
    assert.equal(users.size,4);assert.equal(invalidations,0);
    console.log('PASS: deletion rejects guests, teachers, stale roles, malformed IDs, missing users, self and last admin');

    const page=await request('/api/admin/matches?limit=1&offset=0',{method:'GET'});
    assert.equal(page.status,200);assert.equal(page.data[0].winner_username,'Student');
    assert.ok(!('replay_json' in page.data[0]));
    assert.deepEqual(page.pagination,{limit:1,offset:0,hasMore:false});
    assert.equal((await request('/api/admin/matches/invalid')).status,400);
    assert.equal((await request(`/api/admin/matches/${missingId}`)).status,404);
    const eloBefore=[...users.values()].map(u=>u.elo_rating);
    assert.equal((await request(`/api/admin/matches/${matchId}`)).status,200);
    assert.equal(matches.size,0);assert.deepEqual(forgotten[0],{matchId});
    assert.deepEqual([...users.values()].map(u=>u.elo_rating),eloBefore);
    console.log('PASS: paginated summaries omit replays; deleting one match clears cached replay without changing Elo');

    matches.set(matchId,{id:matchId,player1_id:studentId});
    failDelete=true;
    assert.equal((await request(`/api/admin/users/${studentId}`)).status,500);
    assert.equal(users.has(studentId),true);assert.equal(participants.length,2);
    assert.equal(invalidations,1);
    failDelete=false;
    // Same stale token is issued before deletion and checked after deletion.
    token(studentId,'STUDENT');
    assert.equal((await request(`/api/admin/users/${studentId}`)).status,200);
    assert.equal(users.has(studentId),false);assert.equal(bots.length,0);assert.equal(matches.size,0);
    assert.deepEqual(participants,[{id:teacherId}]);
    assert.deepEqual(forgotten[1],{userId:studentId});assert.equal(invalidations,2);
    assert.equal((await request('/private',{id:studentId,role:'STUDENT',method:'GET'})).status,401);
    assert.ok(statements.some(({sql})=>sql.includes('pg_advisory_xact_lock(87292103)')));
    console.log('PASS: account deletion is transactional, cleans registrations/cascaded records, invalidates caches and blocks old tokens');
  } finally {await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
