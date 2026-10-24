/**
 * GameEngine Class - State Machine managing Rock-Paper-Scissors tactical board game rules,
 * turn transitions, buff activations, combat resolutions, and MatchReplay generation.
 */

const { Board, DIFFICULTY_LEVELS } = require('./Board');
const { Player } = require('./Player');
const { Piece, PIECE_TYPES } = require('./Piece');
const { BuffManager, ITEM_TYPES } = require('./Buffs');

const GAME_STATES = Object.freeze({
  INITIALIZING: 'INITIALIZING',
  WAITING_FOR_PLAYER_1: 'WAITING_FOR_PLAYER_1',
  WAITING_FOR_PLAYER_2: 'WAITING_FOR_PLAYER_2',
  PROCESSING_TURN: 'PROCESSING_TURN',
  FINISHED: 'FINISHED',
});

const WIN_REASONS = Object.freeze({
  ELIMINATION: 'ELIMINATION',             // Toàn bộ quân đối phương bị tiêu diệt hoặc đồng hóa
  PIECE_COUNT_ADVANTAGE: 'PIECE_COUNT_ADVANTAGE', // Hết số lượt quy định, bên có nhiều quân hơn thắng
  TIMEOUT: 'TIMEOUT',                     // Quá thời gian quy định cho một lượt đi
  INVALID_MOVE: 'INVALID_MOVE',           // Đi nước cờ phạm quy
  INFINITE_LOOP: 'INFINITE_LOOP',         // Lặp lại trạng thái bàn cờ quá số lần cho phép
  DRAW: 'DRAW',                           // Hòa cờ
  SURRENDER: 'SURRENDER',                 // Đầu hàng
});

class GameEngine {
  /**
   * @param {Object} options
   * @param {string} [options.matchId] - Unique match UUID
   * @param {number} [options.boardSize=8] - 8 for 8x8 or 9 for 9x9
   * @param {string} [options.difficulty='medium'] - 'easy'|'medium'|'hard'|'random'
   * @param {Object} [options.player1] - { id, name, eloRating }
   * @param {Object} [options.player2] - { id, name, eloRating }
   * @param {number} [options.maxTurns=150] - Maximum turn limit before forced adjudication
   * @param {number} [options.turnTimeoutMs=1000] - Allowed thinking time per turn
   * @param {Object} [options.customLayout] - Optional custom map layout
   */
  constructor({
    matchId,
    boardSize = 8,
    difficulty = DIFFICULTY_LEVELS.MEDIUM,
    player1 = {},
    player2 = {},
    maxTurns = 150,
    turnTimeoutMs = 1000,
    customLayout = null,
  } = {}) {
    this.matchId = matchId || `match_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.boardSize = boardSize;
    this.difficulty = difficulty;
    this.maxTurns = maxTurns;
    this.turnTimeoutMs = turnTimeoutMs;

    this.player1 = new Player({
      id: player1.id || 'p1',
      playerNumber: 1,
      name: player1.name || 'Player 1',
      eloRating: player1.eloRating || 1200,
    });

    this.player2 = new Player({
      id: player2.id || 'p2',
      playerNumber: 2,
      name: player2.name || 'Player 2',
      eloRating: player2.eloRating || 1200,
    });

    this.board = new Board({
      size: this.boardSize,
      difficulty: this.difficulty,
      customLayout,
    });

    this.state = GAME_STATES.INITIALIZING;
    this.currentTurnPlayerNumber = 1;
    this.turnCount = 0;
    this.startTime = Date.now();
    this.endTime = null;

    this.winner = null;
    this.winReason = null;

    // Track repeated board states to detect infinite loops / stagnation
    this.boardStateHistory = new Map();

    // Comprehensive replay timeline
    this.replay = {
      matchId: this.matchId,
      boardSize: this.boardSize,
      difficulty: this.difficulty,
      maxTurns: this.maxTurns,
      players: {
        player1: this.player1.toJSON(),
        player2: this.player2.toJSON(),
      },
      initialBoard: this.board.toSnapshot(),
      turns: [],
      result: null,
    };

    // Update piece rosters initially
    this.syncPlayerPieceCounts();
    this.state = GAME_STATES.WAITING_FOR_PLAYER_1;
  }

  /**
   * Synchronize active pieces on board with Player instances
   */
  syncPlayerPieceCounts() {
    const p1Pieces = this.board.getPiecesForPlayer(1);
    const p2Pieces = this.board.getPiecesForPlayer(2);
    this.player1.updatePieceCount(p1Pieces.length);
    this.player2.updatePieceCount(p2Pieces.length);
  }

  /**
   * Get Player instance for given player number
   * @param {number} playerNum
   * @returns {Player}
   */
  getPlayer(playerNum) {
    return playerNum === 1 ? this.player1 : this.player2;
  }

  /**
   * Get opponent Player instance
   * @param {number} playerNum
   * @returns {Player}
   */
  getOpponent(playerNum) {
    return playerNum === 1 ? this.player2 : this.player1;
  }

  /**
   * Validate move legality according to tactical RPS rules & active buffs
   * @param {number} playerNum - 1 or 2
   * @param {Object} move - { fromRow, fromCol, toRow, toCol, intermediateStep?: { row, col } }
   * @returns {{ isValid: boolean, error?: string, isSpeedMove?: boolean }}
   */
  validateMove(playerNum, move) {
    if (this.state === GAME_STATES.FINISHED) {
      return { isValid: false, error: 'Trận đấu đã kết thúc.' };
    }

    if (playerNum !== this.currentTurnPlayerNumber) {
      return { isValid: false, error: `Chưa đến lượt của Người chơi ${playerNum}.` };
    }

    if (!move || typeof move !== 'object') {
      return { isValid: false, error: 'Dữ liệu nước đi không hợp lệ.' };
    }

    const { fromRow, fromCol, toRow, toCol, intermediateStep } = move;

    if (
      !this.board.isInside(fromRow, fromCol) ||
      !this.board.isInside(toRow, toCol)
    ) {
      return { isValid: false, error: 'Tọa độ nước đi nằm ngoài phạm vi bàn cờ.' };
    }

    const sourceTile = this.board.getTile(fromRow, fromCol);
    const piece = sourceTile?.piece;

    if (!piece) {
      return { isValid: false, error: `Không có quân cờ nào tại ô xuất phát [${fromRow}, ${fromCol}].` };
    }

    if (piece.player !== playerNum) {
      return { isValid: false, error: `Quân cờ tại [${fromRow}, ${fromCol}] không thuộc về Người chơi ${playerNum}.` };
    }

    // Destination checks
    if (fromRow === toRow && fromCol === toCol) {
      return { isValid: false, error: 'Vị trí đích phải khác vị trí xuất phát.' };
    }

    if (this.board.isObstacle(toRow, toCol)) {
      return { isValid: false, error: 'Không thể di chuyển vào ô Chướng ngại vật.' };
    }

    const destTile = this.board.getTile(toRow, toCol);
    if (destTile.piece && destTile.piece.player === playerNum) {
      return { isValid: false, error: 'Không thể đi vào ô đang có quân cờ của chính mình.' };
    }

    // Distance calculation
    const dr = Math.abs(toRow - fromRow);
    const dc = Math.abs(toCol - fromCol);
    const manhattanDist = dr + dc;

    // Normal move: exactly 1 orthogonal step
    const isSingleOrthogonalStep = (dr === 1 && dc === 0) || (dr === 0 && dc === 1);

    if (isSingleOrthogonalStep) {
      return { isValid: true, isSpeedMove: false };
    }

    // Speed Potion move (allows 2 steps)
    if (piece.hasSpeedBuff) {
      // 2-step straight move (distance 2 along same row or col)
      const isTwoStepStraight = (dr === 2 && dc === 0) || (dr === 0 && dc === 2);
      // 2-step diagonal-corner move (dr === 1 && dc === 1)
      const isTwoStepCorner = dr === 1 && dc === 1;

      if (isTwoStepStraight || isTwoStepCorner) {
        // Verify intermediate path is not blocked by obstacles
        let midR = fromRow;
        let midC = fromCol;

        if (intermediateStep && this.board.isInside(intermediateStep.row, intermediateStep.col)) {
          midR = intermediateStep.row;
          midC = intermediateStep.col;
        } else if (isTwoStepStraight) {
          midR = fromRow + (toRow - fromRow) / 2;
          midC = fromCol + (toCol - fromCol) / 2;
        } else {
          // In corner move, pick an intermediate cell that is free of obstacles
          if (!this.board.isObstacle(fromRow, toCol)) {
            midR = fromRow;
            midC = toCol;
          } else {
            midR = toRow;
            midC = fromCol;
          }
        }

        if (this.board.isObstacle(midR, midC)) {
          return { isValid: false, error: `Đường di chuyển 2 bước bị chặn bởi Chướng ngại vật tại [${midR}, ${midC}].` };
        }

        return { isValid: true, isSpeedMove: true };
      }
    }

    return {
      isValid: false,
      error: `Khoảng cách di chuyển không hợp lệ (Quân thường chỉ đi 1 bước trực giao; quân có Buff Tăng Tốc được đi tối đa 2 bước).`,
    };
  }

  /**
   * Execute a validated turn move
   * @param {number} playerNum - 1 or 2
   * @param {Object} move - { fromRow, fromCol, toRow, toCol }
   * @returns {Object} Turn event execution report
   */
  processMove(playerNum, move) {
    this.state = GAME_STATES.PROCESSING_TURN;
    this.turnCount++;

    const validation = this.validateMove(playerNum, move);
    if (!validation.isValid) {
      // Player forfeits due to illegal move
      this.finishGame(this.getOpponent(playerNum).playerNumber, WIN_REASONS.INVALID_MOVE);
      return {
        success: false,
        error: validation.error,
        winReason: WIN_REASONS.INVALID_MOVE,
      };
    }

    const { fromRow, fromCol, toRow, toCol } = move;
    const attackerPiece = this.board.removePieceAt(fromRow, fromCol);
    const destTile = this.board.getTile(toRow, toCol);
    const defenderPiece = destTile.piece;
    const tileItem = destTile.item;

    const turnLog = {
      turnNumber: this.turnCount,
      player: playerNum,
      move: { from: [fromRow, fromCol], to: [toRow, toCol] },
      isSpeedMove: validation.isSpeedMove,
      buffEvent: null,
      combatEvent: null,
      timestamp: Date.now(),
    };

    // 1. Consume Speed Buff if used
    if (attackerPiece.hasSpeedBuff) {
      attackerPiece.consumeSpeedBuff();
    }

    // 2. Consume Item/Buff on destination tile (if any)
    if (tileItem && BuffManager.isConsumableBuff(tileItem)) {
      const buffResult = BuffManager.applyBuff(attackerPiece, tileItem, this.board);
      this.board.removeItemAt(toRow, toCol);
      this.getPlayer(playerNum).recordBuffCollected();
      turnLog.buffEvent = buffResult;
    }

    // 3. Resolve Combat if an enemy piece is present
    if (defenderPiece) {
      const combatOutcome = attackerPiece.evaluateCombat(defenderPiece);
      const combatLog = {
        attacker: attackerPiece.toJSON(),
        defender: defenderPiece.toJSON(),
        outcome: combatOutcome,
        isInfected: false,
      };

      if (combatOutcome === 'WIN') {
        this.getPlayer(playerNum).recordKill();
        this.getOpponent(playerNum).recordDeath();

        // Check Infection Potion trigger
        if (attackerPiece.hasInfectionBuff) {
          attackerPiece.consumeInfectionBuff();
          defenderPiece.convertOwnership(playerNum);
          this.getPlayer(playerNum).recordInfection();

          combatLog.isInfected = true;
          combatLog.description = `Buff Đồng Hóa kích hoạt! Quân địch ${defenderPiece.type} không bị giết mà bị đồng hóa thành quân của Người chơi ${playerNum}!`;

          // Both attacker and newly converted defender now stay on board
          // Attacker takes destination tile, converted piece placed at adjacent empty tile
          this.board.setPieceAt(toRow, toCol, attackerPiece);
          const emptyAdjacent = this.board.findAdjacentEmptyTile(toRow, toCol);
          if (emptyAdjacent) {
            this.board.setPieceAt(emptyAdjacent.row, emptyAdjacent.col, defenderPiece);
          }
        } else {
          // Standard elimination: defender killed, attacker occupies destination tile
          this.board.setPieceAt(toRow, toCol, attackerPiece);
        }
      } else if (combatOutcome === 'LOSE') {
        // Attacker is eliminated, defender survives
        this.getOpponent(playerNum).recordKill();
        this.getPlayer(playerNum).recordDeath();
        // Defender remains at destTile
        combatLog.description = `Quân tấn công ${attackerPiece.type} bị hạ gục bởi ${defenderPiece.type}.`;
      } else {
        // TIE: Mutual destruction
        this.getPlayer(playerNum).recordDeath();
        this.getOpponent(playerNum).recordDeath();
        this.board.removePieceAt(toRow, toCol); // Defender removed
        combatLog.description = `Hòa cờ Kéo Búa Bao (${attackerPiece.type} vs ${defenderPiece.type}): Cả 2 quân cùng biến mất!`;
      }

      turnLog.combatEvent = combatLog;
    } else {
      // Free tile movement: piece simply occupies target cell
      this.board.setPieceAt(toRow, toCol, attackerPiece);
    }

    // Update piece rosters and check vitality
    this.syncPlayerPieceCounts();
    turnLog.boardSnapshot = this.board.toSnapshot();
    this.replay.turns.push(turnLog);

    // 4. Check Win / Termination Conditions
    this.checkGameTermination();

    // If game continues, pass turn to next player
    if (this.state !== GAME_STATES.FINISHED) {
      this.currentTurnPlayerNumber = this.currentTurnPlayerNumber === 1 ? 2 : 1;
      this.state =
        this.currentTurnPlayerNumber === 1
          ? GAME_STATES.WAITING_FOR_PLAYER_1
          : GAME_STATES.WAITING_FOR_PLAYER_2;
    }

    return {
      success: true,
      turnLog,
      isGameOver: this.state === GAME_STATES.FINISHED,
      winner: this.winner,
      winReason: this.winReason,
    };
  }

  /**
   * Check termination conditions after every turn
   */
  checkGameTermination() {
    const p1Pieces = this.player1.remainingPieces;
    const p2Pieces = this.player2.remainingPieces;

    // Condition A: Elimination
    if (p1Pieces === 0 && p2Pieces === 0) {
      this.finishGame(null, WIN_REASONS.DRAW);
      return;
    }
    if (p1Pieces === 0) {
      this.finishGame(2, WIN_REASONS.ELIMINATION);
      return;
    }
    if (p2Pieces === 0) {
      this.finishGame(1, WIN_REASONS.ELIMINATION);
      return;
    }

    // Condition B: Infinite Loop / Stagnation detection
    const stateHash = JSON.stringify(this.board.toSnapshot());
    const count = (this.boardStateHistory.get(stateHash) || 0) + 1;
    this.boardStateHistory.set(stateHash, count);

    if (count >= 5) {
      // Repetitive cycles penalty
      const winner = p1Pieces > p2Pieces ? 1 : p2Pieces > p1Pieces ? 2 : null;
      this.finishGame(winner, WIN_REASONS.INFINITE_LOOP);
      return;
    }

    // Condition C: Max Turns Reached
    if (this.turnCount >= this.maxTurns) {
      if (p1Pieces > p2Pieces) {
        this.finishGame(1, WIN_REASONS.PIECE_COUNT_ADVANTAGE);
      } else if (p2Pieces > p1Pieces) {
        this.finishGame(2, WIN_REASONS.PIECE_COUNT_ADVANTAGE);
      } else {
        this.finishGame(null, WIN_REASONS.DRAW);
      }
    }
  }

  /**
   * Conclude the match and finalize the replay manifest
   * @param {number|null} winnerPlayerNumber - 1, 2, or null (Draw)
   * @param {string} reason
   */
  finishGame(winnerPlayerNumber, reason) {
    this.state = GAME_STATES.FINISHED;
    this.winner = winnerPlayerNumber;
    this.winReason = reason;
    this.endTime = Date.now();

    const durationMs = this.endTime - this.startTime;

    this.replay.result = {
      winner: this.winner,
      winReason: this.winReason,
      totalTurns: this.turnCount,
      durationMs,
      p1PiecesRemaining: this.player1.remainingPieces,
      p2PiecesRemaining: this.player2.remainingPieces,
      player1Stats: this.player1.stats,
      player2Stats: this.player2.stats,
    };
  }

  /**
   * Get all currently valid moves for a player
   * @param {number} playerNum
   * @returns {Array<{ fromRow: number, fromCol: number, toRow: number, toCol: number }>}
   */
  getValidMovesForPlayer(playerNum) {
    const validMoves = [];
    const pieces = this.board.getPiecesForPlayer(playerNum);

    const singleStepDeltas = [
      [-1, 0], [1, 0], [0, -1], [0, 1]
    ];
    const speedDeltas = [
      [-2, 0], [2, 0], [0, -2], [0, 2],
      [-1, -1], [-1, 1], [1, -1], [1, 1]
    ];

    for (const piece of pieces) {
      const r = piece.row;
      const c = piece.col;

      // Check standard 1-step moves
      for (const [dr, dc] of singleStepDeltas) {
        const move = { fromRow: r, fromCol: c, toRow: r + dr, toCol: c + dc };
        if (this.validateMove(playerNum, move).isValid) {
          validMoves.push(move);
        }
      }

      // Check speed moves if piece has speed buff
      if (piece.hasSpeedBuff) {
        for (const [dr, dc] of speedDeltas) {
          const move = { fromRow: r, fromCol: c, toRow: r + dr, toCol: c + dc };
          if (this.validateMove(playerNum, move).isValid) {
            validMoves.push(move);
          }
        }
      }
    }

    return validMoves;
  }

  /**
   * Export complete MatchReplay JSON
   */
  getMatchReplay() {
    return this.replay;
  }
}

module.exports = {
  GameEngine,
  GAME_STATES,
  WIN_REASONS,
};
