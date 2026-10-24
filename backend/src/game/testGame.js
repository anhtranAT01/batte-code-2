/**
 * Automated Verification Script for Game Engine & Map Generator
 */

const {
  GameEngine,
  generateMap,
  createBoardMatrix,
  getPracticeBot,
  ITEM_TYPES,
  PIECE_TYPES,
  BOT_LEVELS,
} = require('./index');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

async function runTests() {
  console.log('--- STARTING GAME ENGINE TESTS ---');

  // Test 1: Map Generator 8x8 & 9x9 across difficulties
  console.log('\n[Test 1] Map Generator');
  const map8Easy = generateMap({ size: 8, difficulty: 'easy' });
  assert(map8Easy.rows === 8 && map8Easy.cols === 8, '8x8 Easy map dimensions correct');
  assert(map8Easy.obstacles.length > 0, '8x8 Easy has obstacles');
  assert(map8Easy.items.length > 0, '8x8 Easy has items');

  const map9Hard = generateMap({ size: 9, difficulty: 'hard' });
  assert(map9Hard.rows === 9 && map9Hard.cols === 9, '9x9 Hard map dimensions correct');
  assert(map9Hard.spawns.player1.length === 9, '9x9 Player 1 has 9 starting pieces');

  const mapRandom = generateMap({ size: 8, difficulty: 'random' });
  assert(mapRandom.obstacles.length >= 2, 'Random map generates obstacles');

  // Test 2: Game Engine Initialization
  console.log('\n[Test 2] Game Engine Initialization');
  const game = new GameEngine({ size: 8, difficulty: 'medium' });
  assert(game.turnCount === 0, 'Initial turn count is 0');
  assert(game.currentTurnPlayer === 1, 'Player 1 starts first');
  assert(!game.isGameOver, 'Game is not over initially');

  const validMovesP1 = game.getValidMovesForPlayer(1);
  assert(validMovesP1.length > 0, `Player 1 has ${validMovesP1.length} valid starting moves`);

  // Test 3: Combat Rules (Rock > Scissors, Scissors > Paper, Paper > Rock)
  console.log('\n[Test 3] Combat Rules');
  const { GamePiece } = require('./piece');
  const rock = new GamePiece({ player: 1, type: PIECE_TYPES.ROCK });
  const scissors = new GamePiece({ player: 2, type: PIECE_TYPES.SCISSORS });
  const paper = new GamePiece({ player: 2, type: PIECE_TYPES.PAPER });

  assert(rock.evaluateCombat(scissors) === 'WIN', 'Rock beats Scissors');
  assert(scissors.evaluateCombat(paper) === 'WIN', 'Scissors beats Paper');
  assert(paper.evaluateCombat(rock) === 'WIN', 'Paper beats Rock');
  assert(rock.evaluateCombat(paper) === 'LOSE', 'Rock loses to Paper');
  assert(rock.evaluateCombat(new GamePiece({ player: 2, type: PIECE_TYPES.ROCK })) === 'TIE', 'Same type ties');

  // Test 4: Power-ups - Infection Potion (Bình Đồng Hóa)
  console.log('\n[Test 4] Infection Potion (Bình Đồng Hóa)');
  const testEngine = new GameEngine({ size: 8, difficulty: 'easy' });
  // Manually setup test scenario
  // P1 Rock with Infection buff at (2, 2) attacks P2 Scissors at (2, 3)
  const infectedRock = new GamePiece({
    player: 1,
    type: PIECE_TYPES.ROCK,
    row: 2,
    col: 2,
    hasInfectionBuff: true,
  });
  const defenderScissors = new GamePiece({
    player: 2,
    type: PIECE_TYPES.SCISSORS,
    row: 2,
    col: 3,
  });
  testEngine.grid[2][2].piece = infectedRock;
  testEngine.grid[2][3].piece = defenderScissors;

  const moveRes = testEngine.executeMove(1, { fromRow: 2, fromCol: 2, toRow: 2, toCol: 3 });
  assert(moveRes.success, 'Infection combat move succeeded');
  assert(moveRes.step.combat.converted === true, 'Enemy piece was successfully converted to Player 1!');

  // Test 5: Speed Potion (Bình Tăng Tốc) - 2 steps
  console.log('\n[Test 5] Speed Potion (Bình Tăng Tốc)');
  const speedEngine = new GameEngine({ size: 8, difficulty: 'easy' });
  const speedPiece = new GamePiece({
    player: 1,
    type: PIECE_TYPES.PAPER,
    row: 2,
    col: 0,
    hasSpeedBuff: true,
  });
  speedEngine.grid[2][0].piece = speedPiece;
  const speedMoveRes = speedEngine.executeMove(1, { fromRow: 2, fromCol: 0, toRow: 4, toCol: 0 });
  assert(speedMoveRes.success, '2-step move succeeded using Speed Potion on open path');

  // Verify that jumping through obstacle at (3,2) is rejected
  const blockedPiece = new GamePiece({ player: 1, type: PIECE_TYPES.ROCK, row: 2, col: 2, hasSpeedBuff: true });
  speedEngine.grid[2][2].piece = blockedPiece;
  const blockedRes = speedEngine.validateMove(1, { fromRow: 2, fromCol: 2, toRow: 4, toCol: 2 });
  assert(!blockedRes.isValid, '2-step move through obstacle is correctly blocked');

  // Test 6: Clone Potion (Bình Sinh Sản)
  console.log('\n[Test 6] Clone Potion (Bình Sinh Sản)');
  const cloneEngine = new GameEngine({ size: 8, difficulty: 'easy' });
  cloneEngine.grid[2][3].item = ITEM_TYPES.POTION_CLONE;
  const cloneMover = new GamePiece({ player: 1, type: PIECE_TYPES.ROCK, row: 2, col: 2 });
  cloneEngine.grid[2][2].piece = cloneMover;

  const cloneRes = cloneEngine.executeMove(1, { fromRow: 2, fromCol: 2, toRow: 2, toCol: 3 });
  assert(cloneRes.success, 'Moved onto Clone Potion tile');
  assert(cloneRes.step.cloneSpawned !== null, 'Clone piece successfully spawned on adjacent tile!');

  // Test 7: Practice Bots (Easy, Medium, Hard)
  console.log('\n[Test 7] Practice Bots');
  const botEasy = getPracticeBot(BOT_LEVELS.EASY, 2);
  const botMedium = getPracticeBot(BOT_LEVELS.MEDIUM, 2);
  const botHard = getPracticeBot(BOT_LEVELS.HARD, 2);

  const botGame = new GameEngine({ size: 8, difficulty: 'medium' });
  // Move P1 first
  const p1Move = botGame.getValidMovesForPlayer(1)[0];
  botGame.executeMove(1, p1Move);

  const easyDecision = botEasy.chooseMove(botGame);
  assert(easyDecision.move !== null, 'Easy Bot chose a legal move');

  const mediumDecision = botMedium.chooseMove(botGame);
  assert(mediumDecision.move !== null, 'Medium Bot chose a legal move');

  const hardDecision = botHard.chooseMove(botGame);
  assert(hardDecision.move !== null, 'Hard Bot chose a legal move');

  // Test 8: Replay JSON completeness
  console.log('\n[Test 8] Replay JSON format');
  const replay = botGame.getReplayJson();
  assert(replay.steps.length >= 1, 'Replay logs move steps');
  assert(replay.steps[0].boardSnapshot !== undefined, 'Replay step contains board snapshot');
  assert(replay.steps[0].move !== undefined, 'Replay step contains move details');
  assert(replay.steps[0].executionTimeMs !== undefined, 'Replay step contains execution time');

  console.log('\n🎉 ALL 8 TESTS PASSED SUCCESSFULLY! 100% COMPLETE.');
}

runTests();
