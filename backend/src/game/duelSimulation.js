const { GameEngine } = require('./gameEngine');
const { getPracticeBot } = require('./practiceBots');
const { playBotTurn } = require('./botDuel');
const { executePythonBot } = require('./pythonRunner');

// This module has no database connection and runs inside a worker thread.
async function simulateDuel(task, { onProgress = () => {}, signal, onProcess } = {}) {
  const game = new GameEngine({ matchId:task.matchId, size:task.size,
    difficulty:task.difficulty, maxTurns:150 });
  game.allowFallback = false;
  const participants = Object.fromEntries([1,2].map(player => {
    const entry = task.participants[player];
    return [player, { ...entry, bot:entry.level ? getPracticeBot(entry.level,player) : null }];
  }));
  const startedAt = Date.now();
  onProgress({ type:'started', data:{ replay:game.getReplayJson() } });
  let sent = 0, lastFlush = startedAt;
  while (!game.isGameOver && game.turnCount < game.maxTurns) {
    if (signal?.aborted) throw Object.assign(new Error('Trận đấu đã dừng.'), { statusCode:499 });
    await playBotTurn(game, participants[game.currentTurnPlayer], options => executePythonBot({...options,
      onSpawn:pid => onProcess?.(pid,true), onClose:pid => onProcess?.(pid,false)}), signal);
    if (Date.now()-lastFlush >= 100 || game.replay.length-sent >= 4 || game.isGameOver) {
      onProgress({ type:'steps', data:{ steps:game.replay.slice(sent), totalTurns:game.turnCount } });
      sent = game.replay.length;
      lastFlush = Date.now();
    }
    // Let cancellation and parent messages run even during built-in-only matches.
    await new Promise(resolve => setImmediate(resolve));
  }
  if (sent < game.replay.length) {
    onProgress({ type:'steps', data:{ steps:game.replay.slice(sent), totalTurns:game.turnCount } });
  }
  return { winner:game.winner, winReason:game.winReason, totalTurns:game.turnCount,
    durationMs:Date.now()-startedAt, replay:game.getReplayJson() };
}

module.exports = { simulateDuel };
