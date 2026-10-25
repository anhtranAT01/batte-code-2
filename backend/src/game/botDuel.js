const { getPracticeBot } = require('./practiceBots');
const { executePythonBot } = require('./pythonRunner');

const TEMPLATES = Object.freeze({
  template_heuristic: { level: 'EASY', name: 'Heuristic Starter Bot' },
  template_speed: { level: 'MEDIUM', name: 'Sát Thủ Tốc Độ' },
  template_alphabeta: { level: 'HARD', name: 'Minimax Alpha-Beta Bot' },
  template_astar: { level: 'GRANDMASTER', name: 'A* Flag Rusher Bot' },
  template_flag_rusher: { level: 'GRANDMASTER', name: 'A* Flag Rusher Bot' },
});

function getTemplateBot(id, player) {
  if (!Object.hasOwn(TEMPLATES, id)) return null;
  const template = TEMPLATES[id];
  return { name: template.name, bot: getPracticeBot(template.level, player) };
}

// Both sides follow the same strict execution path. A failed bot never gets a
// replacement move that would make an unrelated algorithm appear to be running.
async function playBotTurn(game, participant, runPython = executePythonBot) {
  const player = game.currentTurnPlayer;
  if (!game.getValidMovesForPlayer(player).length) {
    game.isGameOver = true;
    game.winner = player === 1 ? 2 : 1;
    game.winReason = 'ELIMINATION';
    return;
  }
  let decision;
  if (participant.bot) {
    decision = participant.bot.chooseMove(game);
  } else {
    const target = player === 1 ? [game.rows - 1, game.cols - 1] : [0, 0];
    const result = await runPython({
      botScriptPath: participant.scriptPath,
      inputPayload: {
        player_id: player, board_size: game.size, grid: game.getBoardSnapshot(),
        turn: game.turnCount,
        my_flag: player === 1 ? [0, 0] : [game.rows - 1, game.cols - 1],
        enemy_flag: target, target_flag: target,
      },
      timeoutMs: 1000,
    });
    if (!result.success) {
      const error = new Error(`${participant.name}: ${result.error || 'Bot không trả về nước đi'}`);
      error.statusCode = 422;
      throw error;
    }
    decision = { move: result.move, calculationTimeMs: result.durationMs };
  }
  const validation = game.validateMove(player, decision?.move);
  if (!validation.isValid) {
    const error = new Error(`${participant.name}: ${validation.reason}`);
    error.statusCode = 422;
    throw error;
  }
  const result = game.executeMove(player, decision.move, decision.calculationTimeMs || 0);
  result.step.botDecision = {
    algorithm: decision.algorithm || (participant.bot ? participant.bot.level : 'PYTHON'),
    reason: decision.reason || 'Nước đi do bot Python trả về',
    searchedNodes: decision.searchedNodes,
    searchDepth: decision.searchDepth,
    pathCost: decision.pathCost,
    target: decision.target,
  };
  return result;
}

module.exports = { getTemplateBot, playBotTurn };
