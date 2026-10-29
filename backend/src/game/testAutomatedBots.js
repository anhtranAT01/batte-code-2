const assert = require('node:assert/strict');
const { GameEngine } = require('./gameEngine');
const { GamePiece } = require('./piece');

// Test the real duel service without a database or Python installation.
const db = require('../config/db');
const savedMatches=[];
db.query = async (sql,args) => {if(sql.includes('INSERT INTO "Matches"'))savedMatches.push(args);return { rows: [] };};
const python = require('./pythonRunner');
python.executePythonBot = async () => { throw new Error('Built-in template unexpectedly invoked Python'); };
const { getTemplateBot, playBotTurn } = require('./botDuel');
const { runAutomatedBotDuel } = require('./gameService');

async function main() {
  for (const [id,level] of [
    ['template_heuristic','EASY'], ['template_speed','MEDIUM'],
    ['template_alphabeta','HARD'], ['template_astar','GRANDMASTER'],
    ['template_flag_rusher','GRANDMASTER'],
  ]) {
    assert.equal(getTemplateBot(id,1).bot.level,level);
    assert.equal(getTemplateBot(id,2).bot.level,level);
  }
  assert.equal(getTemplateBot('missing',1),null);
  console.log('PASS: built-in P1/P2 identities resolve to the selected strategy');

  const failed = new GameEngine();
  const initial = JSON.stringify(failed.getBoardSnapshot());
  await assert.rejects(playBotTurn(failed,{name:'Broken upload',scriptPath:'unused'},async () => ({
    success:false,error:'PROCESS_SPAWN_ERROR: Python missing',
  })),/Python missing/);
  await assert.rejects(playBotTurn(failed,{name:'Invalid upload',scriptPath:'unused'},async () => ({
    success:true,move:{fromRow:0,fromCol:0,toRow:99,toCol:99},
  })),/Invalid upload/);
  assert.equal(failed.turnCount,0);
  assert.equal(failed.replay.length,0);
  assert.equal(JSON.stringify(failed.getBoardSnapshot()),initial);
  console.log('PASS: Python failure/illegal move is reported; no substitute move is played');

  // No immediate item exists. The speed bot must plan toward a distant potion
  // instead of moving the first available piece toward the enemy flag.
  const approach = new GameEngine();
  approach.grid = Array.from({length:8},() => Array.from({length:8},() => ({piece:null,item:null})));
  for (const [player,row,col] of [[2,6,0],[2,6,6],[1,0,7]]) {
    approach.grid[row][col].piece = new GamePiece({player,type:'ROCK',row,col});
  }
  approach.currentTurnPlayer = 2;
  approach.grid[3][6].item = 'POTION_SPEED';
  const speed = getTemplateBot('template_speed',2).bot.chooseMove(approach);
  assert.deepEqual(speed.move,{fromRow:6,fromCol:6,toRow:5,toCol:6});
  console.log('PASS: speed strategy selects the correct piece for a distant speed potion');

  const traces = [];
  const algorithms = {EASY:'GREEDY_HEURISTIC',MEDIUM:'SPEED_TACTICS',HARD:'MINIMAX_ALPHA_BETA',GRANDMASTER:'ASTAR'};
  for (const boardSize of [8,9]) {
  for (const [bot1Id,bot2Level] of [
    ['template_alphabeta','EASY'], ['template_astar','MEDIUM'],
    ['template_speed','HARD'], ['template_heuristic','GRANDMASTER'],
  ]) {
    const result = await runAutomatedBotDuel({bot1Id,bot2Level,boardSize,difficulty:'hard',tournamentId:'test-tournament'});
    assert.equal(savedMatches.at(-1)[9],'test-tournament');
    assert.equal(result.replay.mode,'TOURNAMENT');
    assert.ok(result.totalTurns > 0);
    assert.ok(result.winReason);
    if (bot1Id === 'template_alphabeta' && boardSize === 9) {
      const opening = result.replay.steps.filter(step => step.player === 1).slice(0,3);
      assert.ok(opening.some(step => step.move.fromRow > 0),
        'Alpha-beta must follow a plan instead of advancing row-0 pieces left to right');
    }
    for (const step of result.replay.steps) {
      assert.ok(step.botDecision?.algorithm);
      assert.ok(step.botDecision?.reason);
      const level = step.player === 1 ? getTemplateBot(bot1Id,1).bot.level : bot2Level;
      assert.equal(step.botDecision.algorithm,algorithms[level]);
      assert.ok(!step.warning);
      assert.ok(!step.originalMove);
      if (step.botDecision.algorithm === 'MINIMAX_ALPHA_BETA') {
        assert.equal(step.botDecision.searchDepth,3);
        assert.ok(step.botDecision.searchedNodes > 0);
      }
    }
    traces.push({boardSize,bot1Id,bot2Level,turns:result.totalTurns,reason:result.winReason});
  }
  }
  console.log('PASS: eight full service duels complete on 8x8/9x9 with the selected algorithms and no fallback');
  console.log('PASS: actual duel records and replay metadata retain the owning tournament ID');
  console.log(JSON.stringify(traces,null,2));
  await assert.rejects(runAutomatedBotDuel({bot1Id:'missing'}),/Không tìm thấy/);
  await assert.rejects(runAutomatedBotDuel({bot1Id:'template_astar',bot2Id:'missing'}),/Không tìm thấy/);
  console.log('PASS: missing uploaded bots cannot silently become a different bot');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
