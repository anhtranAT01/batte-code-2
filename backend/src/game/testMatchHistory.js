const assert = require('node:assert/strict');
const {normalizeMatch} = require('./matchHistory');
const old = {id:'old',player1_id:'trex',player2_id:'trex',p1_username:'trex',p2_username:'trex',
  player2_bot_id:null,winner_id:null,win_reason:'FLAG_CAPTURE',replay_json:{winner:2,steps:[]}};
const lost = normalizeMatch(old);
assert.equal(lost.p2_username,'Boss AI');
assert.equal(lost.winner_username,'Boss AI');
assert.equal(lost.winner_side,2);
assert.equal(lost.result_known,true);
assert.equal(normalizeMatch({...old,winner_id:'trex',replay_json:{winner:1}}).winner_username,'trex');
assert.equal(normalizeMatch({...old,win_reason:'DRAW',replay_json:{winner:null}}).winner_side,null);
assert.equal(normalizeMatch({...old,replay_json:[]}).winner_side,2);
assert.equal(normalizeMatch({...old,win_reason:'MAX_TURNS_REACHED',replay_json:[]}).result_known,false);
const pvp = normalizeMatch({...old,player2_id:'another',player2_bot_id:'another-bot',p2_username:'another',
  winner_id:'another',replay_json:{winner:2,mode:'PVP'}});
assert.equal(pvp.mode,'PVP');
assert.equal(pvp.winner_username,'another');
let stored;
require('../config/db').query = async (sql,args) => {
  if (sql.includes('INSERT INTO "Matches"')) stored = args;
  return {rows:sql.includes('FROM "Matches"') ? [old] : []};
};
const service = require('./gameService');
async function main() {
  const practice = await service.createPracticeMatch({userId:'trex',userName:'trex'});
  assert.match(practice.matchId,/^[0-9a-f-]{36}$/);
  const duel = await service.runAutomatedBotDuel({userId:'trex',userName:'trex',bot1Id:'template_heuristic',bot2Level:'EASY',boardSize:8});
  assert.equal(stored[2],null,'Boss cannot use the player account as its identity');
  const replay = JSON.parse(stored[8]);
  assert.equal(replay.mode,'PRACTICE');
  assert.equal(replay.p2Name,'Boss AI (EASY)');
  assert.equal(replay.winner,duel.winner);
  const history = await service.getRecentMatches();
  assert.equal(history[0].p2_username,'Boss AI');
  assert.equal(history[0].winner_username,'Boss AI');
  assert.ok(!('replay_json' in history[0]),'History list must not transfer complete replays');
  const oldReplay = await service.getReplay('old');
  assert.equal(oldReplay.p2Name,'Boss AI');
  assert.equal(oldReplay.winnerName,'Boss AI');
  console.log('PASS: old self-vs-self practice history and bot wins normalize correctly; new practice stores separate names and no fake player2 account');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
