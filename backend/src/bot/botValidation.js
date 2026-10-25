const { GameEngine } = require('../game/gameEngine');
const { buildBotInput } = require('../game/botInput');
const { executePythonBot } = require('../game/pythonRunner');

async function validateBotExecution(filePath) {
  for (const player of [1,2]) {
    const game = new GameEngine({size:9,difficulty:'easy'});
    game.currentTurnPlayer = player;
    const result = await executePythonBot({botScriptPath:filePath,inputPayload:buildBotInput(game),timeoutMs:1000});
    const valid = result.success ? game.validateMove(player,result.move) : null;
    if (!result.success || !valid.isValid) {
      const reason = result.success ? `INVALID_MOVE: ${valid.reason}` : result.error;
      const error = new Error(`Bot chưa tạo được nước đi hợp lệ khi kiểm tra phe ${player}: ${reason}`);
      error.statusCode = 422;
      throw error;
    }
  }
}
module.exports = {validateBotExecution};
