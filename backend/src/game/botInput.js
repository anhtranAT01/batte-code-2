function buildBotInput(game, player = game.currentTurnPlayer) {
  const enemyFlag = player === 1 ? [game.rows - 1, game.cols - 1] : [0, 0];
  return {
    player_id:player,board_size:game.size,grid:game.getBoardSnapshot(),turn:game.turnCount,
    my_flag:player === 1 ? [0,0] : [game.rows - 1,game.cols - 1],
    enemy_flag:enemyFlag,target_flag:enemyFlag,
  };
}
module.exports = {buildBotInput};
