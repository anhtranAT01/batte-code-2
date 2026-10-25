const assert=require('node:assert/strict');
const calls=[];
require('../config/db').query=async (sql,args=[])=>{
  calls.push({sql,args});
  if(sql.includes('INSERT INTO "Matches"')) return {rows:[{match_number:'42'}]};
  if(sql.includes('FROM "Matches"')) return {rows:[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',match_number:'42',
    player1_id:'one',player2_id:'two',p1_username:'One',p2_username:'Two',
    replay_json:{matchNumber:'incorrect-stale-value',mode:'PVP',winner:1,steps:[],initialBoard:[]}}]};
  return {rows:[]};
};
const service=require('./gameService');
async function main(){
  for(const input of ['#042','042','42']){
    const replay=await service.getReplay(input);
    assert.equal(replay.matchNumber,'42');
    assert.equal(replay.matchId,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    assert.match(calls.at(-1).sql,/m.match_number = \$1::bigint/);
    assert.deepEqual(calls.at(-1).args,[input.replace(/^#/,'')]);
  }
  await service.getReplay('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  assert.match(calls.at(-1).sql,/m.id::text = \$1/);
  await service.getReplay('9999999999999999999999999');
  assert.ok(!calls.at(-1).sql.includes('m.match_number = $1::bigint'),'Huge inputs cannot overflow bigint lookup');
  const result=await service.runAutomatedBotDuel({bot1Id:'template_heuristic',bot2Level:'EASY'});
  assert.equal(result.matchNumber,'42');
  assert.equal(result.replay.matchNumber,'42');
  console.log('PASS: numeric/# replay lookup and legacy UUID lookup coexist; saved matches expose authoritative display number');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
