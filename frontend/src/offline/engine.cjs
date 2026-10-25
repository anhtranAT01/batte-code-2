const {GameEngine}=require('../../../backend/src/game/gameEngine');
const {getPracticeBot}=require('../../../backend/src/game/practiceBots');
const {buildBotInput}=require('../../../backend/src/game/botInput');
let game,boss;
self.onmessage=event=>{
  try{
    if(event.data.type==='start'){
      game=new GameEngine({size:event.data.size||9,difficulty:'easy',maxTurns:150});
      boss=getPracticeBot(event.data.level||'EASY',2);
    }else if(event.data.type==='move'){
      const valid=game.validateMove(1,event.data.move);
      if(!valid.isValid)throw new Error('Nước đi không hợp lệ: '+valid.reason);
      game.executeMove(1,event.data.move);
      if(!game.isGameOver){const choice=boss.chooseMove(game);if(!choice.move)throw new Error('Boss không còn nước đi.');game.executeMove(2,choice.move);}
    }
    self.postMessage({type:'board',grid:game.getBoardSnapshot(),turn:game.turnCount,over:game.isGameOver,winner:game.winner,reason:game.winReason});
    if(!game.isGameOver)self.postMessage({type:'input',input:buildBotInput(game,1)});
  }catch(error){self.postMessage({type:'error',message:error.message});}
};
