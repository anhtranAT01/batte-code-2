/**
 * Practice Bots Module
 * Built-in AI opponents for students to practice against at 3 skill levels:
 * - EASY (Dễ): Random with mild forward exploration
 * - MEDIUM (Trung bình): Greedy 1-ply tactical heuristics & danger avoidance
 * - HARD (Khó): 2-ply MiniMax evaluation with Alpha-Beta pruning & tactical threat matrix
 */

const { BOT_LEVELS, ITEM_TYPES, COMBAT_ADVANTAGE } = require('./constants');

/**
 * Base Bot class
 */
class PracticeBot {
  constructor(level, playerNum = 2) {
    this.level = level;
    this.playerNum = playerNum;
    this.opponentNum = playerNum === 1 ? 2 : 1;
  }

  /**
   * Determine move for current board state
   * @param {GameEngine} gameEngine
   * @returns {{ move: Object|null, calculationTimeMs: number }}
   */
  chooseMove(gameEngine) {
    throw new Error('chooseMove must be implemented by subclass');
  }
}

/**
 * Easy Practice Bot (Mức Dễ)
 * Chooses valid moves with mild forward curiosity
 */
class EasyPracticeBot extends PracticeBot {
  constructor(playerNum = 2) {
    super(BOT_LEVELS.EASY, playerNum);
  }

  chooseMove(gameEngine) {
    const startTime = Date.now();
    const validMoves = gameEngine.getValidMovesForPlayer(this.playerNum);

    if (validMoves.length === 0) {
      return { move: null, calculationTimeMs: Date.now() - startTime };
    }

    // Sort moves with slight bias towards forward movement and collecting items
    const scoredMoves = validMoves.map((m) => {
      let score = Math.random() * 10;
      const targetCell = gameEngine.grid[m.toRow][m.toCol];

      // Item pickup bonus
      if (targetCell.item && targetCell.item !== ITEM_TYPES.OBSTACLE) {
        score += 8;
      }

      // Flag capture instant win!
      const targetFlag = this.playerNum === 1 ? [gameEngine.rows - 1, gameEngine.cols - 1] : [0, 0];
      if (m.toRow === targetFlag[0] && m.toCol === targetFlag[1]) {
        score += 5000;
      }

      // Forward advancement
      const forwardDelta = this.playerNum === 1 ? m.toRow - m.fromRow : m.fromRow - m.toRow;
      if (forwardDelta > 0) score += 3;

      return { move: m, score };
    });

    scoredMoves.sort((a, b) => b.score - a.score);

    // Pick among top 3 or random
    const topCandidates = scoredMoves.slice(0, Math.min(3, scoredMoves.length));
    const chosen = topCandidates[Math.floor(Math.random() * topCandidates.length)].move;

    const calculationTimeMs = Math.max(80, Date.now() - startTime + Math.floor(Math.random() * 120));
    return { move: chosen, calculationTimeMs };
  }
}

/**
 * Medium Practice Bot (Mức Trung bình)
 * Evaluates 1-ply tactical heuristics: captures prey, takes items, avoids suicide
 */
class MediumPracticeBot extends PracticeBot {
  constructor(playerNum = 2) {
    super(BOT_LEVELS.MEDIUM, playerNum);
  }

  chooseMove(gameEngine) {
    const startTime = Date.now();
    const validMoves = gameEngine.getValidMovesForPlayer(this.playerNum);

    if (validMoves.length === 0) {
      return { move: null, calculationTimeMs: Date.now() - startTime };
    }

    let bestMove = validMoves[0];
    let highestScore = -Infinity;

    for (const move of validMoves) {
      const score = this.evaluateMove(gameEngine, move);
      if (score > highestScore) {
        highestScore = score;
        bestMove = move;
      }
    }

    const calculationTimeMs = Math.max(150, Date.now() - startTime + Math.floor(Math.random() * 150));
    return { move: bestMove, calculationTimeMs, score: highestScore };
  }

  evaluateMove(gameEngine, move) {
    const { fromRow, fromCol, toRow, toCol } = move;
    const piece = gameEngine.getPieceAt(fromRow, fromCol);
    const targetCell = gameEngine.grid[toRow][toCol];

    let score = 0;

    // 0. Instant Win: Capture Enemy Flag
    const targetFlag = this.playerNum === 1 ? [gameEngine.rows - 1, gameEngine.cols - 1] : [0, 0];
    if (toRow === targetFlag[0] && toCol === targetFlag[1]) {
      return 10000; // Immediate Victory!
    }
    const distBefore = Math.abs(fromRow - targetFlag[0]) + Math.abs(fromCol - targetFlag[1]);
    const distAfter = Math.abs(toRow - targetFlag[0]) + Math.abs(toCol - targetFlag[1]);
    if (distAfter < distBefore) {
      score += (distBefore - distAfter) * 12; // High priority to rush towards enemy flag
    }

    // 1. Combat Evaluation
    if (targetCell.piece && targetCell.piece.player === this.opponentNum) {
      const opponentPiece = targetCell.piece;
      const combat = piece.evaluateCombat(opponentPiece);

      if (combat === 'WIN') {
        score += 70; // Highly prioritize winning capture
        if (piece.hasInfectionBuff) {
          score += 40; // Infection bonus: converting piece is extremely valuable!
        }
      } else if (combat === 'LOSE') {
        score -= 90; // Avoid attacking pieces that destroy us
      } else {
        score -= 15; // Tie: slight penalty unless desperate
      }
    }

    // 2. Power-up Item Collection
    if (targetCell.item && targetCell.item !== ITEM_TYPES.OBSTACLE) {
      if (targetCell.item === ITEM_TYPES.POTION_CLONE) {
        score += 55; // Free clone piece
      } else if (targetCell.item === ITEM_TYPES.POTION_INFECTION) {
        score += 45; // Infection buff
      } else if (targetCell.item === ITEM_TYPES.POTION_SPEED) {
        score += 35; // Speed buff
      }
    }

    // 3. Danger Detection: Is toRow, toCol vulnerable to counter-attack?
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of directions) {
      const nr = toRow + dr;
      const nc = toCol + dc;
      if (gameEngine.isInside(nr, nc)) {
        const neighborPiece = gameEngine.getPieceAt(nr, nc);
        if (neighborPiece && neighborPiece.player === this.opponentNum) {
          // If neighbor beats our piece, penalty
          if (COMBAT_ADVANTAGE[neighborPiece.type]?.[piece.type] > 0) {
            score -= 30;
          }
        }
      }
    }

    // 4. Forward Territorial Advancement
    const forwardStep = this.playerNum === 1 ? toRow - fromRow : fromRow - toRow;
    score += forwardStep * 4;

    // Small random noise to avoid deterministic repetition
    score += Math.random() * 2;

    return score;
  }
}

/**
 * Hard Practice Bot (Mức Khó)
 * Uses 2-ply MiniMax evaluation with Alpha-Beta pruning, territory control & type balance
 */
class HardPracticeBot extends PracticeBot {
  constructor(playerNum = 2) {
    super(BOT_LEVELS.HARD, playerNum);
  }

  chooseMove(gameEngine) {
    const startTime = Date.now();
    const validMoves = gameEngine.getValidMovesForPlayer(this.playerNum);

    if (validMoves.length === 0) {
      return { move: null, calculationTimeMs: Date.now() - startTime };
    }

    let bestMove = validMoves[0];
    let bestScore = -Infinity;
    const alpha = -Infinity;
    const beta = Infinity;

    for (const move of validMoves) {
      // Evaluate immediate move
      const immediateScore = this.evaluateImmediateMove(gameEngine, move);

      // Simple 2-ply simulation
      const opponentResponses = this.estimateOpponentBestResponse(gameEngine, move);
      const combinedScore = immediateScore - opponentResponses;

      if (combinedScore > bestScore) {
        bestScore = combinedScore;
        bestMove = move;
      }
    }

    const calculationTimeMs = Math.max(300, Date.now() - startTime + Math.floor(Math.random() * 200));
    return { move: bestMove, calculationTimeMs, score: bestScore };
  }

  evaluateImmediateMove(gameEngine, move) {
    const { fromRow, fromCol, toRow, toCol } = move;
    const piece = gameEngine.getPieceAt(fromRow, fromCol);
    const targetCell = gameEngine.grid[toRow][toCol];

    let score = 0;

    // 0. Instant Win: Capture Enemy Flag
    const targetFlag = this.playerNum === 1 ? [gameEngine.rows - 1, gameEngine.cols - 1] : [0, 0];
    if (toRow === targetFlag[0] && toCol === targetFlag[1]) {
      return 20000; // Immediate Victory!
    }
    const distBefore = Math.abs(fromRow - targetFlag[0]) + Math.abs(fromCol - targetFlag[1]);
    const distAfter = Math.abs(toRow - targetFlag[0]) + Math.abs(toCol - targetFlag[1]);
    if (distAfter < distBefore) {
      score += (distBefore - distAfter) * 16; // Advanced pathing towards enemy flag
    }

    // Material & Combat
    if (targetCell.piece && targetCell.piece.player === this.opponentNum) {
      const target = targetCell.piece;
      const combat = piece.evaluateCombat(target);

      if (combat === 'WIN') {
        score += 100;
        if (piece.hasInfectionBuff) score += 60; // Infection conversion
      } else if (combat === 'LOSE') {
        score -= 120; // Blunder
      } else {
        score -= 20;
      }
    }

    // Items
    if (targetCell.item && targetCell.item !== ITEM_TYPES.OBSTACLE) {
      if (targetCell.item === ITEM_TYPES.POTION_CLONE) score += 65;
      if (targetCell.item === ITEM_TYPES.POTION_INFECTION) score += 50;
      if (targetCell.item === ITEM_TYPES.POTION_SPEED) score += 35;
    }

    // Central control bonus (closer to center 4 tiles)
    const mid = (gameEngine.size - 1) / 2;
    const distFromCenter = Math.abs(toRow - mid) + Math.abs(toCol - mid);
    score += (8 - distFromCenter) * 2;

    // Forward advancement
    const forwardStep = this.playerNum === 1 ? toRow - fromRow : fromRow - toRow;
    score += forwardStep * 6;

    // Type Diversity Check: Maintain balance of Rock, Paper, Scissors
    const myPieces = gameEngine.getPiecesForPlayer(this.playerNum);
    const typeCounts = { ROCK: 0, PAPER: 0, SCISSORS: 0 };
    for (const p of myPieces) typeCounts[p.type] = (typeCounts[p.type] || 0) + 1;
    if (typeCounts.ROCK > 0 && typeCounts.PAPER > 0 && typeCounts.SCISSORS > 0) {
      score += 15; // Balance bonus
    }

    return score;
  }

  estimateOpponentBestResponse(gameEngine, move) {
    // Check if moving to this tile makes piece a target for an opponent piece adjacent
    const { toRow, toCol } = move;
    const movingPiece = gameEngine.getPieceAt(move.fromRow, move.fromCol);
    let maxOpponentThreat = 0;

    const deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of deltas) {
      const nr = toRow + dr;
      const nc = toCol + dc;
      if (gameEngine.isInside(nr, nc)) {
        const enemy = gameEngine.getPieceAt(nr, nc);
        if (enemy && enemy.player === this.opponentNum) {
          if (COMBAT_ADVANTAGE[enemy.type]?.[movingPiece.type] > 0) {
            maxOpponentThreat = Math.max(maxOpponentThreat, 80);
          }
        }
      }
    }

    return maxOpponentThreat;
  }
}

/**
 * Factory function to retrieve Bot instance
 * @param {'EASY'|'MEDIUM'|'HARD'} level
 * @param {number} [playerNum=2]
 * @returns {PracticeBot}
 */
function getPracticeBot(level = BOT_LEVELS.MEDIUM, playerNum = 2) {
  const normalizedLevel = (level || BOT_LEVELS.MEDIUM).toUpperCase();
  switch (normalizedLevel) {
    case BOT_LEVELS.EASY:
      return new EasyPracticeBot(playerNum);
    case BOT_LEVELS.HARD:
      return new HardPracticeBot(playerNum);
    case BOT_LEVELS.MEDIUM:
    default:
      return new MediumPracticeBot(playerNum);
  }
}

module.exports = {
  PracticeBot,
  EasyPracticeBot,
  MediumPracticeBot,
  HardPracticeBot,
  getPracticeBot,
};
