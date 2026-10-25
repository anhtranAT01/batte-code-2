/** Four distinct built-in practice strategies. */
const { BOT_LEVELS, ITEM_TYPES } = require('./constants');
const { GamePiece } = require('./piece');
const STEPS = [[-1,0],[1,0],[0,-1],[0,1]];
const SPEED_STEPS = [...STEPS,[-2,0],[2,0],[0,-2],[0,2],[-1,-1],[-1,1],[1,-1],[1,1]];
const flagFor = (game, player) => player === 1 ? [game.rows-1, game.cols-1] : [0,0];
const distance = (r,c,flag) => Math.abs(r-flag[0])+Math.abs(c-flag[1]);

// Terrain distances guide goals beyond the immediate neighborhood. Pieces are
// dynamic; only fixed obstacles belong in this reusable distance field.
function terrainDistances(game, r, c) {
  const distances = Array.from({length:game.rows}, () => Array(game.cols).fill(Infinity));
  const queue = [[r,c]];
  distances[r][c] = 0;
  for (let i = 0; i < queue.length; i++) {
    const [row,col] = queue[i];
    for (const [dr,dc] of STEPS) {
      const nr = row+dr, nc = col+dc;
      if (!game.isInside(nr,nc) || game.grid[nr][nc].item === ITEM_TYPES.OBSTACLE
        || distances[nr][nc] !== Infinity) continue;
      distances[nr][nc] = distances[row][col]+1;
      queue.push([nr,nc]);
    }
  }
  return distances;
}

function potionGoals(game) {
  const goals = [];
  for (let r = 0; r < game.rows; r++) {
    for (let c = 0; c < game.cols; c++) {
      const item = game.grid[r][c].item;
      if (item && item !== ITEM_TYPES.OBSTACLE) {
        goals.push({r,c,item,distances:terrainDistances(game,r,c)});
      }
    }
  }
  return goals;
}

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
  copy.executeMove(copy.currentTurnPlayer, move, 0, { recordReplay: false });
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
  explainMove(game,move) {
    const cell = game.grid[move.toRow][move.toCol];
    const piece = game.getPieceAt(move.fromRow,move.fromCol);
    if (distance(move.toRow,move.toCol,flagFor(game,this.playerNum)) === 0
      && (!cell.piece || piece.evaluateCombat(cell.piece) === 'WIN')) return 'Chiếm cờ đối phương';
    if (cell.piece) return 'Chọn giao tranh theo tương khắc Kéo–Búa–Bao';
    if (cell.item) return `Thu thập ${cell.item}`;
    return 'Cải thiện vị trí để tiếp cận cờ và vật phẩm';
  }
}
class EasyPracticeBot extends PracticeBot {
  constructor(playerNum = 2) { super(BOT_LEVELS.EASY,playerNum); }
  chooseMove(game) {
    const start = Date.now();
    const move = this.rankedMoves(game)[0]?.move || null;
    return {move,algorithm:'GREEDY_HEURISTIC',reason:move ? this.explainMove(game,move) : 'Không còn nước đi',
      calculationTimeMs:Date.now()-start};
  }
}
class MediumPracticeBot extends PracticeBot {
  constructor(playerNum = 2) { super(BOT_LEVELS.MEDIUM,playerNum); }
  evaluateMove(game,move,player = this.playerNum) {
    let score = super.evaluateMove(game,move,player);
    if (Math.abs(score) >= 1000) return score;
    const piece = game.getPieceAt(move.fromRow,move.fromCol);
    if (game.grid[move.toRow][move.toCol].item === ITEM_TYPES.POTION_SPEED) score += 110;
    // Pursue speed potions several turns away, using routes around walls.
    if (!piece.hasSpeedBuff) {
      let approach = 0;
      for (const goal of this.speedGoals || []) {
        const before = goal.distances[move.fromRow][move.fromCol];
        const after = goal.distances[move.toRow][move.toCol];
        if (Number.isFinite(before) && Number.isFinite(after)) {
          approach = Math.max(approach, 90/(after+1)-90/(before+1));
        }
      }
      score += approach;
    }
    if (Math.abs(move.toRow-move.fromRow)+Math.abs(move.toCol-move.fromCol) === 2) score += 12;
    for (const enemy of game.getPiecesForPlayer(player === 1 ? 2 : 1)) {
      if (enemy.row === move.toRow && enemy.col === move.toCol) continue;
      if (enemy.evaluateCombat(piece) === 'WIN' && canReach(game,enemy,move.toRow,move.toCol)) score -= 65;
    }
    return score;
  }
  chooseMove(game) {
    const start = Date.now();
    this.speedGoals = potionGoals(game).filter(goal => goal.item === ITEM_TYPES.POTION_SPEED);
    const best = this.rankedMoves(game)[0];
    return {move:best?.move || null,score:best?.score,algorithm:'SPEED_TACTICS',
      reason:best ? `${this.explainMove(game,best.move)}; ưu tiên lộ trình lấy Tăng Tốc và đột kích an toàn` : 'Không còn nước đi',
      calculationTimeMs:Date.now()-start};
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
      const sign = player === this.playerNum ? 1 : -1;
      const pieces = game.getPiecesForPlayer(player);
      let nearest = game.rows+game.cols;
      for (const piece of pieces) {
        nearest = Math.min(nearest,distance(piece.row,piece.col,flagFor(game,player)));
        const value = 100+(piece.hasSpeedBuff ? 30 : 0)+(piece.hasInfectionBuff ? 40 : 0);
        score += player === this.playerNum ? value : -value;
      }
      score += (player === this.playerNum ? -1 : 1)*nearest*12;
      // Item control must matter before a potion can be collected within three
      // plies, otherwise all quiet opening advances receive identical scores.
      for (const goal of this.goals || []) {
        if (game.grid[goal.r][goal.c].item !== goal.item) continue;
        let closest = Infinity;
        for (const piece of pieces) closest = Math.min(closest,goal.distances[piece.row][piece.col]);
        const value = ({POTION_CLONE:65,POTION_INFECTION:45,POTION_SPEED:40})[goal.item];
        score += sign*value/(closest+1);
      }
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
    this.goals = potionGoals(game);
    let bestMove = null, bestScore = -Infinity;
    for (const {move} of this.rankedMoves(game)) {
      // Three real plies: our move, enemy response, our continuation.
      const score = this.search(simulate(game,move),2,bestScore,Infinity);
      if (score > bestScore) { bestScore = score; bestMove = move; }
    }
    return {move:bestMove,score:bestScore,searchedNodes:this.nodes,searchDepth:3,
      algorithm:'MINIMAX_ALPHA_BETA',
      reason:'Minimax 3 lượt (mình–địch–mình), tỉa Alpha-Beta; cân nhắc cờ, quân số, buff và quyền tiếp cận vật phẩm',
      calculationTimeMs:Date.now()-start};
  }
}
class FlagRusherPracticeBot extends PracticeBot {
  constructor(playerNum = 2) { super(BOT_LEVELS.GRANDMASTER,playerNum); }
  findPath(game,piece) {
    const flag = flagFor(game,this.playerNum);
    const potions = new Map();
    for (let r = 0; r < game.rows; r++) {
      for (let c = 0; c < game.cols; c++) {
        if (game.grid[r][c].item === ITEM_TYPES.POTION_SPEED) {
          potions.set(`${r},${c}`,1n << BigInt(potions.size));
        }
      }
    }
    const key = node => `${node.r},${node.c},${Number(node.speed)},${node.collected}`;
    const start = {r:piece.row,c:piece.col,speed:piece.hasSpeedBuff,collected:0n,cost:0,first:null};
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
        const potionBit = potions.get(`${r},${c}`) || 0n;
        const picksUpSpeed = potionBit !== 0n && (node.collected & potionBit) === 0n;
        const next = {r,c,speed:!longMove && (node.speed || picksUpSpeed),
          collected:node.collected | potionBit,
          cost:node.cost+1+danger, first:node.first || {
            fromRow:piece.row,fromCol:piece.col,toRow:r,toCol:c,
          }};
        // Consumed potions are part of the graph state: revisiting a square
        // cannot regenerate a speed buff. Positive costs eliminate useless cycles.
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
    if (immediate?.score >= 100000) return {move:immediate.move,algorithm:'ASTAR',
      reason:'Chiếm cờ ngay trong lượt này',calculationTimeMs:Date.now()-start};
    let best = null;
    for (const piece of game.getPiecesForPlayer(this.playerNum)) {
      const route = this.findPath(game,piece);
      if (route?.first && (!best || route.cost < best.cost)) best = route;
    }
    return {move:best?.first || immediate?.move || null,
      algorithm:'ASTAR',target:flagFor(game,this.playerNum),
      reason:best ? 'Đi bước đầu của đường A* tới cờ, tính vật cản, Tăng Tốc và nguy cơ bị khắc chế'
        : 'Chưa tìm được đường cướp cờ; chọn nước chiến thuật để mở đường',
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
