const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { GameEngine } = require('./gameEngine');
const { GamePiece } = require('./piece');
const { getPracticeBot } = require('./practiceBots');
const levels = ['EASY','MEDIUM','HARD','GRANDMASTER'];
function board(pieces, items = []) {
  const game = new GameEngine({size:8});
  game.grid = Array.from({length:8},() => Array.from({length:8},() => ({piece:null,item:null})));
  for (const [player,type,row,col,buffs = {}] of pieces) {
    game.grid[row][col].piece = new GamePiece({player,type,row,col,...buffs});
  }
  for (const [r,c,item] of items) game.grid[r][c].item = item;
  game.currentTurnPlayer = 2;
  return game;
}
const move = (r,c,tr,tc) => ({fromRow:r,fromCol:c,toRow:tr,toCol:tc});

assert.equal(new Set(levels.map(level => getPracticeBot(level).constructor)).size,4);
assert.throws(() => getPracticeBot('INVALID'),/Unknown practice bot/);
assert.equal(getPracticeBot('grandmaster').level,'GRANDMASTER');
const ui = fs.readFileSync(path.join(__dirname,'../../../frontend/src/components/BossArenaView.jsx'),'utf8');
assert.match(ui,/bot2Level: selectedBoss\.id,/);
console.log('PASS: four distinct strategies and boss selection preserves identity');

const resources = board([[2,'ROCK',4,4],[1,'PAPER',0,7]],[
  [4,3,'POTION_CLONE'],[4,5,'POTION_SPEED'],
]);
assert.deepEqual(getPracticeBot('EASY').chooseMove(resources).move,move(4,4,4,3));
assert.deepEqual(getPracticeBot('MEDIUM').chooseMove(resources).move,move(4,4,4,5));
console.log('PASS: heuristic prefers clone while speed bot prefers speed');

const defense = board([[2,'ROCK',4,4],[2,'PAPER',7,6],
  [1,'SCISSORS',4,3],[1,'ROCK',6,7],[1,'ROCK',0,5]]);
assert.deepEqual(getPracticeBot('EASY').chooseMove(defense).move,move(4,4,4,3));
const before = JSON.stringify(defense.getBoardSnapshot());
const hard = getPracticeBot('HARD').chooseMove(defense);
assert.deepEqual(hard.move,move(7,6,7,7));
assert.ok(hard.searchedNodes > defense.getValidMovesForPlayer(2).length);
assert.equal(JSON.stringify(defense.getBoardSnapshot()),before);
assert.equal(defense.replay.length,0);
assert.equal(defense.turnCount,0);
assert.equal(defense.boardStateHistory.size,0);
console.log('PASS: alpha-beta defends flag instead of taking bait; search leaves live game intact');

// A wall forces the runner to move away from the flag before progressing.
const maze = board([[2,'ROCK',2,2],[1,'SCISSORS',7,7]],[
  [2,3,'POTION_CLONE'],
  [1,2,'OBSTACLE'],[2,1,'OBSTACLE'],[1,3,'OBSTACLE'],[2,4,'OBSTACLE'],[1,4,'OBSTACLE'],
]);
const runner = getPracticeBot('GRANDMASTER').chooseMove(maze);
assert.deepEqual(runner.move,move(2,2,3,2));
assert.notDeepEqual(runner.move,getPracticeBot('EASY').chooseMove(maze).move);
console.log('PASS: A* finds a detour around obstacles');

for (const player of [1,2]) {
  const win = player === 2 ? board([[2,'ROCK',0,1],[1,'SCISSORS',0,0]])
    : board([[1,'ROCK',7,6],[2,'SCISSORS',7,7]]);
  win.currentTurnPlayer = player;
  for (const level of levels) {
    const decision = getPracticeBot(level,player).chooseMove(win);
    const flag = player === 2 ? [0,0] : [7,7];
    assert.deepEqual([decision.move.toRow,decision.move.toCol],flag);
    assert.ok(win.validateMove(player,decision.move).isValid);
  }
}
console.log('PASS: every strategy captures a winning flag for either side');

// Speed movement must obey the same obstacle and one-use buff rules as the engine.
const speed = board([[2,'ROCK',0,2,{hasSpeedBuff:true}],[1,'SCISSORS',7,7]]);
assert.deepEqual(getPracticeBot('GRANDMASTER').chooseMove(speed).move,move(0,2,0,0));
speed.grid[0][1].item = 'OBSTACLE';
assert.notDeepEqual(getPracticeBot('GRANDMASTER').chooseMove(speed).move,move(0,2,0,0));
for (const level of levels) {
  const empty = board([[1,'ROCK',7,7]]);
  assert.equal(getPracticeBot(level).chooseMove(empty).move,null);
}
console.log('PASS: A* respects speed obstacles; every bot handles no legal moves');

for (const size of [8,9]) {
  const game = new GameEngine({size,maxTurns:40});
  while (!game.isGameOver) {
    const level = levels[game.turnCount % levels.length];
    const decision = getPracticeBot(level,game.currentTurnPlayer).chooseMove(game);
    if (!decision.move) break;
    assert.ok(game.validateMove(game.currentTurnPlayer,decision.move).isValid,level);
    game.executeMove(game.currentTurnPlayer,decision.move);
  }
}
console.log('PASS: mixed-strategy games produce legal moves on 8x8 and 9x9');
