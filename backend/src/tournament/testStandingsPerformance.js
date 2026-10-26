const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const participants=Array.from({length:1000},(_,i)=>({userId:`p-${i}`,username:`Player${i}`,elo:1200,points:0}));
const matches=[];
for(let round=0;round<7;round++)for(let i=0;i<500;i++)matches.push({id:`${round}-${i}`,player1_id:`p-${i}`,player2_id:`p-${999-i}`,winner_id:round%3===0?null:`p-${round%2?i:999-i}`,win_reason:round%3===0?'DRAW':'FLAG_CAPTURE',duration_ms:100+round,total_turns:80+round,p1_elo_change:1,p2_elo_change:-1,has_infinite_loop_error:round===2});
const dbPath=require.resolve('../config/db'),redisPath=require.resolve('../config/redis');
require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{query:async sql=>{
  if(sql.includes('FROM "Tournaments"'))return {rows:[{id:'fixture',name:'Fixture',settings_json:{participants}}]};
  assert.match(sql,/AS total_turns/);
  assert.ok(!/m\.replay_json\s*\n\s*FROM/.test(sql),'Do not select full replay snapshots');
  return {rows:matches};
},pool:{}}};
require.cache[redisPath]={id:redisPath,filename:redisPath,loaded:true,exports:{matchQueue:{}}};
const service=require('./tournament.service');
function baseline(){
  return participants.map(p=>{
    let wins=0,draws=0,losses=0,eloDelta=0,turns=0,count=0;
    for(const m of matches){if(m.player1_id!==p.userId && m.player2_id!==p.userId)continue;
      count++;turns+=m.total_turns;eloDelta+=m.player1_id===p.userId?m.p1_elo_change:m.p2_elo_change;
      if(m.winner_id===p.userId)wins++;else if(m.winner_id)losses++;else if(m.win_reason==='DRAW')draws++;
    }return {userId:p.userId,matchesPlayed:count,wins,draws,losses,eloDelta,avgTurns:Math.round(turns/count)};
  });
}
async function main(){
  const expected=baseline(),actual=await service.getTournamentStandings('fixture');
  const byId=new Map(actual.standings.map(row=>[row.userId,row]));
  for(const expectedRow of expected){const row=byId.get(expectedRow.userId);for(const key of Object.keys(expectedRow))assert.equal(row[key],expectedRow[key],`${key}: ${row.userId}`);}
  const before=[],after=[];
  for(let i=0;i<7;i++){let start=performance.now();baseline();before.push(performance.now()-start);start=performance.now();await service.getTournamentStandings('fixture');after.push(performance.now()-start);}
  const median=a=>Number(a.sort((a,b)=>a-b)[3].toFixed(2));
  console.log('PASS: 1,000 participants / 3,500 matches produce identical results with grouped aggregation and no replay transfer.');
  console.log(JSON.stringify({participants:1000,matches:3500,baselineMedianMs:median(before),optimizedMedianMs:median(after)}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
