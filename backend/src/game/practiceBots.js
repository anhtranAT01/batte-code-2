/** Four distinct built-in practice strategies. */
const { BOT_LEVELS, ITEM_TYPES } = require('./constants');
const { GamePiece } = require('./piece');
const STEPS = [[-1,0],[1,0],[0,-1],[0,1]];
const SPEED_STEPS = [...STEPS,[-2,0],[2,0],[0,-2],[0,2],[-1,-1],[-1,1],[1,-1],[1,1]];
const flagFor = (game, player) => player === 1 ? [game.rows-1, game.cols-1] : [0,0];
const distance = (r,c,flag) => Math.abs(r-flag[0])+Math.abs(c-flag[1]);

function canReach(game,piece,r,c) {
  const dr = r-piece.row, dc = c-piece.col;
  if (!(piece.hasSpeedBuff ? SPEED_STEPS : STEPS).some(([a,b]) => a === dr && b === dc)) return false;
  return !((Math.abs(dr) === 2 || Math.abs(dc) === 2)
    && game.grid[piece.row+dr/2][piece.col+dc/2].item === ITEM_TYPES.OBSTACLE);
}

// Search uses actual engine rules on isolated pieces, buffs and repetition history.
function simulate(game, move) {
  const copy = Object.assign(Object.create(Object.getPrototypeOf(game)), game);
  copy.grid = game.grid.map(row => row.map(cell => ({ ...cell,
    piece: cell.piece ? new GamePiece(cell.piece.toJSON()) : null,
  })));
  copy.boardStateHistory = new Map(game.boardStateHistory);
  copy.replay = [];
  copy.allowFallback = false;
  copy.executeMove(copy.currentTurnPlayer, move);
  return copy;
}

class PracticeBot {
  constructor(level, playerNum = 2) {
    this.level = level;
    this.playerNum = playerNum;
    this.opponentNum = playerNum === 1 ? 2 : 1;
  }
  chooseMove() { throw new Error('chooseMove must be implemented by subclass'); }
  rankedMoves(game, player = this.playerNum) {
    return game.getValidMovesForPlayer(player)
      .map(move => ({move, score: this.evaluateMove(game,move,player)}))
      .sort((a,b) => b.score-a.score);
  }
  evaluateMove(game, move, player = this.playerNum) {
    const piece = game.getPieceAt(move.fromRow,move.fromCol);
    const target = game.grid[move.toRow][move.toCol];
    const duel = target.piece ? piece.evaluateCombat(target.piece) : null;
    if (duel === 'LOSE') return -1000;
    if (duel === 'TIE') return -100;
    const flag = flagFor(game,player);
    if (distance(move.toRow,move.toCol,flag) === 0) return 100000;
    let score = duel === 'WIN' ? 80+(piece.hasInfectionBuff ? 50 : 0) : 0;
    score += ({POTION_CLONE:50,POTION_INFECTION:35,POTION_SPEED:25})[target.item] || 0;
    score += (distance(move.fromRow,move.fromCol,flag)-distance(move.toRow,move.toCol,flag))*3;
    return score;
  }
}
class EasyPracticeBot extends PracticeBot {
  constructor(playerNum = 2) { super(BOT_LEVELS.EASY,playerNum); }
  chooseMove(game) {
    const start = Date.now();
    return {move:this.rankedMoves(game)[0]?.move || null,calculationTimeMs:Date.now()-start};
  }
}
class MediumPracticeBot extends PracticeBot {
  constructor(playerNum = 2) { super(BOT_LEVELS.MEDIUM,playerNum); }
  evaluateMove(game,move,player = this.playerNum) {
    let score = super.evaluateMove(game,move,player);
    if (Math.abs(score) >= 1000) return score;
    const piece = game.getPieceAt(move.fromRow,move.fromCol);
    if (game.grid[move.toRow][move.toCol].item === ITEM_TYPES.POTION_SPEED) score += 110;
    if (Math.abs(move.toRow-move.fromRow)+Math.abs(move.toCol-move.fromCol) === 2) score += 12;
    for (const enemy of game.getPiecesForPlayer(player === 1 ? 2 : 1)) {
      if (enemy.row === move.toRow && enemy.col === move.toCol) continue;
      if (enemy.evaluateCombat(piece) === 'WIN' && canReach(game,enemy,move.toRow,move.toCol)) score -= 65;
    }
    return score;
  }
  chooseMove(game) {
    const start = Date.now(), best = this.rankedMoves(game)[0];
    return {move:best?.move || null,score:best?.score,calculationTimeMs:Date.now()-start};
  }
}
class HardPracticeBot extends PracticeBot {
  constructor(playerNum = 2) { super(BOT_LEVELS.HARD,playerNum); }
  evaluateBoard(game,depth) {
    if (game.isGameOver) {
      if (game.winner === null) return 0;
      return game.winner === this.playerNum ? 1000000+depth : -1000000-depth;
    }
    let score = 0;
    for (const player of [this.playerNum,this.opponentNum]) {
      let nearest = game.rows+game.cols;
      for (const piece of game.getPiecesForPlayer(player)) {
        nearest = Math.min(nearest,distance(piece.row,piece.col,flagFor(game,player)));
        const value = 100+(piece.hasSpeedBuff ? 30 : 0)+(piece.hasInfectionBuff ? 40 : 0);
        score += player === this.playerNum ? value : -value;
      }
      score += (player === this.playerNum ? -1 : 1)*nearest*12;
    }
    return score;
  }
  search(game,depth,alpha,beta) {
    this.nodes++;
    if (game.isGameOver || depth === 0) return this.evaluateBoard(game,depth);
    const maximizing = game.currentTurnPlayer === this.playerNum;
    const moves = this.rankedMoves(game,game.currentTurnPlayer);
    if (!moves.length) return maximizing ? -1000000-depth : 1000000+depth;
    let best = maximizing ? -Infinity : Infinity;
    for (const {move} of moves) {
      const score = this.search(simulate(game,move),depth-1,alpha,beta);
      best = maximizing ? Math.max(best,score) : Math.min(best,score);
      if (maximizing) alpha = Math.max(alpha,best);
      else beta = Math.min(beta,best);
      if (alpha >= beta) break;
    }
    return best;
  }
  chooseMove(game) {
    const start = Date.now();
    this.nodes = 0;
    let bestMove = null, bestScore = -Infinity;
    for (const {move} of this.rankedMoves(game)) {
      // Three real plies: our move, enemy response, our continuation.
      const score = this.search(simulate(game,move),2,bestScore,Infinity);
      if (score > bestScore) { bestScore = score; bestMove = move; }
    }
    return {move:bestMove,score:bestScore,searchedNodes:this.nodes,calculationTimeMs:Date.now()-start};
  }
}
class FlagRusherPracticeBot extends PracticeBot {
  constructor(playerNum = 2) { super(BOT_LEVELS.GRANDMASTER,playerNum); }
  findPath(game,piece) {
    const flag = flagFor(game,this.playerNum);
    const key = node => `${node.r},${node.c},${Number(node.speed)}`;
    const start = {r:piece.row,c:piece.col,speed:piece.hasSpeedBuff,cost:0,first:null};
    const open = [start], costs = new Map([[key(start),0]]);
    const heuristic = node => distance(node.r,node.c,flag)/2;
    const enemies = game.getPiecesForPlayer(this.opponentNum);
    while (open.length) {
      open.sort((a,b) => (a.cost+heuristic(a))-(b.cost+heuristic(b)));
      const node = open.shift();
      if (node.cost !== costs.get(key(node))) continue;
      if (distance(node.r,node.c,flag) === 0) return node;
      for (const [dr,dc] of node.speed ? SPEED_STEPS : STEPS) {
        const r = node.r+dr, c = node.c+dc;
        if (!game.isInside(r,c)) continue;
        const cell = game.grid[r][c];
        if (cell.item === ITEM_TYPES.OBSTACLE) continue;
        if ((Math.abs(dr) === 2 || Math.abs(dc) === 2)
          && game.grid[node.r+dr/2][node.c+dc/2].item === ITEM_TYPES.OBSTACLE) continue;
        const occupant = r === piece.row && c === piece.col ? null : cell.piece;
        if (occupant && (occupant.player === this.playerNum || piece.evaluateCombat(occupant) !== 'WIN')) continue;
        let danger = 0;
        for (const enemy of enemies) {
          if (enemy === occupant || enemy.evaluateCombat(piece) !== 'WIN') continue;
          if (canReach(game,enemy,r,c)) danger += 3;
        }
        const longMove = Math.abs(dr)+Math.abs(dc) === 2;
        const next = {r,c,speed:!longMove && (node.speed || cell.item === ITEM_TYPES.POTION_SPEED),
          cost:node.cost+1+danger, first:node.first || {
            fromRow:piece.row,fromCol:piece.col,toRow:r,toCol:c,
          }};
        // Prevent cycles and revisiting consumed potions along the proposed route.
        if (node.visited?.has(`${r},${c}`) || (r === piece.row && c === piece.col)) continue;
        next.visited = new Set(node.visited || [`${piece.row},${piece.col}`]);
        next.visited.add(`${r},${c}`);
        if (next.cost >= (costs.get(key(next)) ?? Infinity)) continue;
        costs.set(key(next),next.cost);
        open.push(next);
      }
    }
    return null;
  }
  chooseMove(game) {
    const start = Date.now();
    const immediate = this.rankedMoves(game)[0];
    if (immediate?.score >= 100000) return {move:immediate.move,calculationTimeMs:Date.now()-start};
    let best = null;
    for (const piece of game.getPiecesForPlayer(this.playerNum)) {
      const route = this.findPath(game,piece);
      if (route?.first && (!best || route.cost < best.cost)) best = route;
    }
    return {move:best?.first || immediate?.move || null,
      pathCost:best?.cost,calculationTimeMs:Date.now()-start};
  }
}
function getPracticeBot(level = BOT_LEVELS.MEDIUM,playerNum = 2) {
  switch (String(level || BOT_LEVELS.MEDIUM).toUpperCase()) {
    case BOT_LEVELS.EASY: return new EasyPracticeBot(playerNum);
    case BOT_LEVELS.MEDIUM: return new MediumPracticeBot(playerNum);
    case BOT_LEVELS.HARD: return new HardPracticeBot(playerNum);
    case BOT_LEVELS.GRANDMASTER: return new FlagRusherPracticeBot(playerNum);
    default: throw new Error(`Unknown practice bot level: ${level}`);
  }
}
module.exports = {PracticeBot,EasyPracticeBot,MediumPracticeBot,HardPracticeBot,
  FlagRusherPracticeBot,getPracticeBot};
