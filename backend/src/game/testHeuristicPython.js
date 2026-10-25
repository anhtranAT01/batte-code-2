const assert = require('node:assert/strict');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {GameEngine} = require('./gameEngine');
const {GamePiece} = require('./piece');
const filename = path.resolve(__dirname,'../../../sample-bots/heuristic.py');
function choose(game,player) {
  const result = spawnSync(process.env.TEST_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'),[filename],{
    input:JSON.stringify({player_id:player,board_size:game.size,grid:game.getBoardSnapshot()}),encoding:'utf8',timeout:1500,
  });
  assert.equal(result.status,0,String(result.error || result.stderr));
  assert.equal(result.stdout.trim().split('\n').length,1);
  const move = JSON.parse(result.stdout);
  assert.ok(game.validateMove(player,move).isValid,JSON.stringify(move));
  return move;
}
for (const size of [8,9]) {
  const game = new GameEngine({size,maxTurns:24});
  game.allowFallback = false;
  while (!game.isGameOver && game.getValidMovesForPlayer(game.currentTurnPlayer).length) {
    game.executeMove(game.currentTurnPlayer,choose(game,game.currentTurnPlayer));
  }
}
const game = new GameEngine();
game.grid = Array.from({length:8},() => Array.from({length:8},() => ({piece:null,item:null})));
game.grid[7][6].piece = new GamePiece({player:1,type:'ROCK',row:7,col:6});
game.grid[7][7].piece = new GamePiece({player:2,type:'SCISSORS',row:7,col:7});
assert.deepEqual(choose(game,1),{fromRow:7,fromCol:6,toRow:7,toCol:7});
game.grid[0][2].piece = new GamePiece({player:2,type:'ROCK',row:0,col:2,hasSpeedBuff:true});
game.grid[0][1].item = 'OBSTACLE';
assert.notDeepEqual(choose(game,2),{fromRow:0,fromCol:2,toRow:0,toCol:0});
console.log('PASS: standalone heuristic.py emits one legal JSON move, plays 8x8/9x9, takes a winning flag and respects speed obstacles');
