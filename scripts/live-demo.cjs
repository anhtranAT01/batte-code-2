// Explicitly invoked demo: normal public APIs, real uploads and real matches.
// Private credentials stay in ignored .local-demo; never print them or commit them.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const dir = path.join(root, '.local-demo');
const file = path.join(dir, 'live-demo.json');
const base = 'https://battle-code-api.onrender.com';
if (!process.argv.includes('--live')) throw new Error('Use --live to explicitly target the live game.');
fs.mkdirSync(dir, {recursive:true});
const state = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,'utf8'))
  : {run:'demo_1029',createdAt:new Date().toISOString(),players:[],matches:[],registrations:[]};
const save = () => {fs.writeFileSync(file+'.tmp',JSON.stringify(state,null,2));fs.renameSync(file+'.tmp',file);};
async function api(route,body,token,method='POST') {
  const isForm = body instanceof FormData;
  const response = await fetch(base+route,{method,headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(!isForm&&body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:isForm?body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(180000)});
  const result = await response.json();
  if (!response.ok || result.success === false) throw new Error(`${route}: HTTP ${response.status}: ${result.message || JSON.stringify(result.errors)}`);
  return result.data ?? result;
}
async function players() {
  for(let i=0;i<20;i++) {
    let p=state.players[i];
    if(!p) {const n=String(i+1).padStart(2,'0');p={username:`${state.run}_${n}`,password:crypto.randomBytes(24).toString('base64url'),studentId:`DEMO1029_${n}`,teamName:`Demo Đội ${n}`,email:`${state.run}_${n}@example.invalid`};state.players.push(p);save();}
    if(!p.id) {
      let account;
      try {account=await api('/api/auth/register',{...p,role:'STUDENT',consent:true});}
      catch(error) {if(!/409|tồn tại|sử dụng/i.test(error.message))throw error;account=await api('/api/auth/login',{username:p.username,password:p.password});}
      p.id=account.user.id;p.token=account.token;save();
    }
    if(!p.botId) {
      const templates=['heuristic.py','astar_flag_rusher_bot.py','flag_rusher_strategy_bot.py','student_bot_template.py'];
      p.template=templates[i%templates.length];
      const form=new FormData();form.set('name',`Demo Bot ${String(i+1).padStart(2,'0')}`);
      form.set('file',new Blob([fs.readFileSync(path.join(root,'sample-bots',p.template))],{type:'text/x-python'}),p.template);
      const bot=await api('/api/bots/upload',form,p.token);p.botId=bot.id;save();
      await api(`/api/bots/${p.botId}/activate`,{},p.token);
    }
    console.log(`READY ${i+1}/20 ${p.username} (${p.template})`);
  }
}
async function matches() {
  assert.equal(state.players.length,20);
  for(let i=0;i<20;i+=2) {
    const p1=state.players[i],p2=state.players[i+1];
    if(state.matches.some(m=>m.p1===p1.id&&m.p2===p2.id))continue;
    const started=Date.now();
    const result=await api('/api/game/pvp',{opponentUserId:p2.id,boardSize:i%4===0?9:8},p1.token);
    assert.ok(result.matchId);assert.ok(result.totalTurns>0);
    const replay=await api(`/api/game/replay/${result.matchId}`,null,null,'GET');
    assert.ok(replay);
    state.matches.push({p1:p1.id,p2:p2.id,matchId:result.matchId,matchNumber:result.matchNumber,winner:result.winner,winReason:result.winReason,totalTurns:result.totalTurns,wallMs:Date.now()-started});save();
    console.log(`SAVED PvP ${state.matches.length}/10 #${result.matchNumber} ${result.totalTurns} turns (${result.winReason})`);
  }
}
async function register(tournamentId) {
  if(!tournamentId)throw new Error('Missing --tournament ID');
  for(const p of state.players) {
    if(state.registrations.some(r=>r.tournamentId===tournamentId&&r.userId===p.id))continue;
    await api(`/api/tournaments/${tournamentId}/register`,{botId:p.botId,teamName:p.teamName},p.token);
    state.registrations.push({tournamentId,userId:p.id});save();console.log(`REGISTERED ${p.username}`);
  }
}
async function report() {
  const publicState={run:state.run,createdAt:state.createdAt,updatedAt:new Date().toISOString(),players:state.players.map(({id,username,teamName,botId,template})=>({id,username,teamName,botId,template})),matches:state.matches,registrations:state.registrations,tournaments:state.tournaments,snapshots:state.snapshots};
  fs.writeFileSync(path.join(root,'docs/live-demo-results.json'),JSON.stringify(publicState,null,2)+'\n');
}
async function tournaments() {
  const list=await api('/api/tournaments',null,null,'GET');
  const all=list.filter(t=>t.name?.startsWith('Demo 20 người chơi'));
  state.tournaments=all.map(t=>({id:t.id,name:t.name,mode:t.mode}));save();
  for(const t of all) {
    if(t.mode==='ALL_IN')await register(t.id);
    else {
      for(let i=0;i<8;i++) {
        const p=state.players[i];
        if(state.registrations.some(r=>r.tournamentId===t.id&&r.userId===p.id))continue;
        await api(`/api/tournaments/${t.id}/brackets/join`,{bracketMatchId:`b_qf${Math.floor(i/2)+1}`,slot:i%2?'p2':'p1',botId:p.botId,teamName:p.teamName},p.token);
        state.registrations.push({tournamentId:t.id,userId:p.id});save();console.log(`BRACKET ${i+1}/8 ${p.username}`);
      }
    }
    console.log(`TOURNAMENT ${t.mode} ${t.id}`);
  }
}
async function verify() {
  state.snapshots=[];
  const list=await api('/api/tournaments',null,null,'GET');
  for(const t of list.filter(t=>state.tournaments?.some(s=>s.id===t.id))) {
    const standings=await api(`/api/tournaments/${t.id}/standings`,null,null,'GET');
    state.snapshots.push({id:t.id,name:t.name,status:t.status,brackets:t.brackets_json,standings});
    console.log(`VERIFIED ${t.name} ${t.status}`);
  }
  save();
}
(async()=>{
  const phase=process.argv.find(x=>['players','matches','register','report','tournaments','verify'].includes(x));
  if(phase==='players')await players();
  else if(phase==='matches')await matches();
  else if(phase==='register')await register(process.argv[process.argv.indexOf('--tournament')+1]);
  else if(phase==='tournaments')await tournaments();
  else if(phase==='verify')await verify();
  else if(phase!=='report')throw new Error('Choose players, matches, register or report');
  await report();
})().catch(error=>{console.error(error.message);process.exitCode=1;});
