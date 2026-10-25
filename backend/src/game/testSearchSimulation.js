const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { GameEngine } = require('./gameEngine');
const { GamePiece } = require('./piece');
const { getPracticeBot } = require('./practiceBots');

function copyGame(game) {
  const copy = Object.assign(Object.create(GameEngine.prototype), game);
  copy.grid = game.grid.map(row => row.map(cell => ({ ...cell,
    piece: cell.piece ? new GamePiece(cell.piece.toJSON()) : null,
  })));
  copy.boardStateHistory = new Map(game.boardStateHistory);
  copy.replay = [];
  return copy;
}

function fixture(pieces, items = []) {
  const game = new GameEngine({ size: 8, maxTurns: 120 });
  game.grid = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => ({ piece: null, item: null })));
  for (const [player, type, row, col, buffs = {}] of pieces) {
    game.grid[row][col].piece = new GamePiece({ player, type, row, col, ...buffs });
  }
  for (const [row, col, item] of items) game.grid[row][col].item = item;
  return game;
}

const move = (fromRow, fromCol, toRow, toCol) => ({ fromRow, fromCol, toRow, toCol });
const snapshot = GameEngine.prototype.getBoardSnapshot;
function gameState(game) {
  return {
    board: snapshot.call(game),
    turnCount: game.turnCount,
    currentTurnPlayer: game.currentTurnPlayer,
    isGameOver: game.isGameOver,
    winner: game.winner,
    winReason: game.winReason,
    repetition: [...game.boardStateHistory],
  };
}

function assertEquivalent(game, moves) {
  const recorded = copyGame(game), search = copyGame(game);
  search.getBoardSnapshot = () => { throw new Error('An isolated search move generated a replay snapshot'); };
  const random = Math.random;
  try {
    // Cloning assigns cosmetic random IDs; give both executions identical IDs.
    Math.random = () => 0.25;
    for (const nextMove of moves) {
      const result = recorded.executeMove(recorded.currentTurnPlayer, nextMove);
      const searchResult = search.executeMove(search.currentTurnPlayer, nextMove, 0, { recordReplay: false });
      assert.equal(searchResult.success, result.success);
      assert.equal(searchResult.step, undefined);
      assert.deepEqual(gameState(search), gameState(recorded));
      assert.equal(search.replay.length, 0);
      if (result.step) assert.ok(result.step.boardSnapshot);
    }
  } finally { Math.random = random; }
  assert.ok(recorded.replay.length > 0, 'Real moves still record their replay');
  return recorded;
}

assertEquivalent(fixture([[1, 'ROCK', 2, 2], [2, 'PAPER', 6, 6]], [[2, 3, 'POTION_CLONE']]), [move(2, 2, 2, 3)]);
assertEquivalent(fixture([[1, 'ROCK', 2, 2], [2, 'PAPER', 6, 6]], [[2, 3, 'POTION_SPEED']]), [move(2, 2, 2, 3)]);
assertEquivalent(fixture([[1, 'ROCK', 2, 2], [2, 'PAPER', 6, 6]], [[2, 3, 'POTION_INFECTION']]), [move(2, 2, 2, 3)]);
assertEquivalent(fixture([[1, 'ROCK', 3, 3, { hasSpeedBuff: true }], [2, 'PAPER', 6, 6]]), [move(3, 3, 3, 5)]);
assertEquivalent(fixture([[1, 'ROCK', 3, 3, { hasInfectionBuff: true }], [2, 'SCISSORS', 3, 4], [2, 'PAPER', 6, 6]]), [move(3, 3, 3, 4)]);
for (const defenderType of ['ROCK', 'PAPER', 'SCISSORS']) {
  assertEquivalent(fixture([[1, 'ROCK', 3, 3], [2, defenderType, 3, 4]]), [move(3, 3, 3, 4)]);
}
const flag = assertEquivalent(fixture([[1, 'ROCK', 7, 6], [2, 'SCISSORS', 7, 7]]), [move(7, 6, 7, 7)]);
assert.equal(flag.winReason, 'FLAG_CAPTURE');
const limited = fixture([[1, 'ROCK', 3, 3], [2, 'PAPER', 6, 6]]);
limited.maxTurns = 1;
assert.equal(assertEquivalent(limited, [move(3, 3, 3, 4)]).winReason, 'MAX_TURNS_REACHED');
const invalid = fixture([[1, 'ROCK', 3, 3], [2, 'PAPER', 6, 6]]);
invalid.allowFallback = false;
assert.equal(assertEquivalent(invalid, [move(3, 3, 99, 99)]).winReason, 'INVALID_MOVE');
assertEquivalent(fixture([[1, 'ROCK', 3, 3], [2, 'PAPER', 6, 6]]), [move(3, 3, 99, 99)]);
const repeated = fixture([[1, 'ROCK', 3, 3], [2, 'PAPER', 6, 6]]);
const cycle = [move(3, 3, 3, 4), move(6, 6, 6, 5), move(3, 4, 3, 3), move(6, 5, 6, 6)];
const repeatedMoves = Array.from({ length: 17 }, (_, index) => cycle[index % cycle.length]);
assert.equal(assertEquivalent(repeated, repeatedMoves).winReason, 'INFINITE_LOOP');
console.log('PASS: replay-free simulation preserves buffs, clones, all combat outcomes, flags, turn limits, strict/fallback moves and repetition');

// Run the same deterministic full match with and without the old discarded
// search snapshots. Compare decisions and state; timings are diagnostic only.
const initial = new GameEngine({ size: 9, difficulty: 'hard', maxTurns: 80 });
const execute = GameEngine.prototype.executeMove;
function benchmark(recordSearchReplay) {
  const game = copyGame(initial), bots = { 1: getPracticeBot('HARD', 1), 2: getPracticeBot('HARD', 2) };
  const decisions = [];
  let snapshots = 0;
  const random = Math.random;
  GameEngine.prototype.getBoardSnapshot = function () { snapshots++; return snapshot.call(this); };
  if (recordSearchReplay) GameEngine.prototype.executeMove = function (player, nextMove, ms) {
    return execute.call(this, player, nextMove, ms);
  };
  const began = performance.now();
  try {
    Math.random = () => 0.25;
    while (!game.isGameOver) {
      const decision = bots[game.currentTurnPlayer].chooseMove(game);
      assert.ok(decision.move);
      decisions.push({ move: decision.move, score: decision.score, nodes: decision.searchedNodes,
        algorithm: decision.algorithm, depth: decision.searchDepth });
      game.executeMove(game.currentTurnPlayer, decision.move);
    }
  } finally {
    GameEngine.prototype.executeMove = execute;
    GameEngine.prototype.getBoardSnapshot = snapshot;
    Math.random = random;
  }
  return { game, decisions, snapshots, elapsedMs: +(performance.now() - began).toFixed(2) };
}
const before = benchmark(true), after = benchmark(false);
assert.deepEqual(after.decisions, before.decisions);
assert.deepEqual(gameState(after.game), gameState(before.game));
assert.equal(after.game.replay.length, before.game.replay.length);
assert.ok(after.game.replay.every(step => step.boardSnapshot));
assert.equal(after.snapshots, after.game.turnCount);
assert.ok(before.snapshots > after.snapshots * 10);
console.log('PASS: all minimax moves/scores/node counts and real replay snapshots remain identical');
console.log(JSON.stringify({ turns: after.game.turnCount,
  before: { elapsedMs: before.elapsedMs, snapshots: before.snapshots },
  after: { elapsedMs: after.elapsedMs, snapshots: after.snapshots } }));
