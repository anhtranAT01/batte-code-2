const assert=require('node:assert/strict');
const {runRealBrackets}=require('./runRealBrackets');
const participants=Array.from({length:8},(_,i)=>({userId:`u${i}`,username:`demo${i}`,botId:`bot${i}`,botName:`Bot ${i}`}));
function fixture() {
 const brackets=Array.from({length:4},(_,i)=>({id:`b_qf${i+1}`,round:1,matchNumber:i+1,status:'PENDING',p1:{id:`u${i*2}`,name:`demo${i*2}`},p2:{id:`u${i*2+1}`,name:`demo${i*2+1}`}}));
 for(const [id,round,n] of [['b_sf1',2,5],['b_sf2',2,6],['b_fn1',3,7]])brackets.push({id,round,matchNumber:n,status:'PENDING',p1:{name:'Thắng trận trước'},p2:{name:'Thắng trận trước'}});
 return {id:'tournament',settings_json:{participants,boardSize:9},brackets_json:brackets};
}
(async()=>{
 const tournament=fixture();let calls=0,checkpoints=[];
 const play=async args=>{assert.equal(args.tournamentId,'tournament');assert.ok(args.bot1Id&&args.bot2Id);return {matchId:`real${++calls}`,winner:2,winReason:'FLAG_CAPTURE'};};
 const result=await runRealBrackets({tournament,play,checkpoint:async(b,status)=>checkpoints.push(status)});
 assert.equal(calls,7);assert.equal(result.completed,true);assert.equal(result.brackets[6].winner,'demo7');assert.equal(checkpoints.at(-1),'COMPLETED');
 await runRealBrackets({tournament,play,checkpoint:async()=>{}});assert.equal(calls,7);
 console.log('PASS real bracket winners advance with their actual bot; seven persisted checkpoints; rerun skips completed games');
 const draw=fixture();const unresolved=await runRealBrackets({tournament:draw,play:async()=>({matchId:'draw',winner:null,winReason:'DRAW'}),checkpoint:async()=>{}});
 assert.equal(unresolved.completed,false);assert.equal(unresolved.played,4);assert.ok(draw.brackets_json.slice(0,4).every(m=>m.winner===null&&m.status==='DRAW'));
 console.log('PASS draws never get an invented knockout winner or advance into the final');
 const invalid=fixture();invalid.settings_json.participants=[];
 await assert.rejects(runRealBrackets({tournament:invalid,play:async()=>{throw new Error('Must not play');},checkpoint:async()=>{}}),/Chưa có người chơi/);
 console.log('PASS unassigned placeholders cannot be simulated as real participants');
})().catch(e=>{console.error(e);process.exitCode=1;});
