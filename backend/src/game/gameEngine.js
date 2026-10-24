/**
 * GameEngine Class - Core Rules, Power-up Activations, Combat Resolution & Replay System
 */

const { BOARD_SIZES, ITEM_TYPES, WIN_REASONS } = require('./constants');
const { generateMap, createBoardMatrix } = require('./mapGenerator');
const { GamePiece } = require('./piece');

class GameEngine {
  /**
   * @param {Object} options
   * @param {string} [options.matchId] - Match UUID
   * @param {number} [options.size=8] - 8 or 9
   * @param {string} [options.difficulty='medium'] - 'easy'|'medium'|'hard'|'random'
   * @param {number} [options.maxTurns=150] - Turn limit
   * @param {Object} [options.customMap] - Pre-built map configuration
   */
  constructor({
    matchId,
    size = BOARD_SIZES.SIZE_8,
    difficulty = 'medium',
    maxTurns = 150,
    customMap = null,
  } = {}) {
    this.matchId = matchId || `match_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.size = size === 9 ? 9 : 8;
    this.rows = this.size;
    this.cols = this.size;
    this.difficulty = difficulty;
    this.maxTurns = maxTurns;

    // Load or generate map
    this.mapConfig = customMap || generateMap({ size: this.size, difficulty: this.difficulty });
    this.grid = createBoardMatrix(this.mapConfig);

    this.turnCount = 0;
    this.currentTurnPlayer = 1; // Player 1 starts
    this.isGameOver = false;
    this.winner = null;        // 1, 2, or null (draw)
    this.winReason = null;     // 'ELIMINATION'|'MAX_TURNS_REACHED'|'INFINITE_LOOP'|etc.

    // Repetition tracker for Infinite Loop detection
    this.boardStateHistory = new Map();

    // Initial Board snapshot before any moves
    this.initialBoardSnapshot = this.getBoardSnapshot();

    // Complete Replay History
    this.replay = [];
  }

  /**
   * Check if coordinate is within board boundaries
   */
  isInside(r, c) {
    return r >= 0 && r < this.rows && c >= 0 && c < this.cols;
  }

  /**
   * Get piece at coordinate
   */
  getPieceAt(r, c) {
    if (!this.isInside(r, c)) return null;
    return this.grid[r][c].piece;
  }

  /**
   * Get item at coordinate
   */
  getItemAt(r, c) {
    if (!this.isInside(r, c)) return null;
    return this.grid[r][c].item;
  }

  /**
   * Find adjacent empty tiles for Clone Potion spawning
   */
  findAdjacentEmptyTile(r, c) {
    const candidateDeltas = [
      [0, 1], [0, -1], [1, 0], [-1, 0],
      [1, 1], [1, -1], [-1, 1], [-1, -1]
    ];

    for (const [dr, dc] of candidateDeltas) {
      const nr = r + dr;
      const nc = c + dc;
      if (this.isInside(nr, nc)) {
        const cell = this.grid[nr][nc];
        if (!cell.piece && (!cell.item || cell.item !== ITEM_TYPES.OBSTACLE)) {
          return [nr, nc];
        }
      }
    }
    return null;
  }

  /**
   * Comprehensive validation for a proposed move
   * @param {number} playerNum - 1 or 2
   * @param {Object} move - { fromRow, fromCol, toRow, toCol }
   * @returns {{ isValid: boolean, reason?: string }}
   */
  validateMove(playerNum, move) {
    if (!move || typeof move !== 'object') {
      return { isValid: false, reason: 'Nước đi không hợp lệ (Dữ liệu rỗng)' };
    }

    const { fromRow, fromCol, toRow, toCol } = move;

    if (!this.isInside(fromRow, fromCol) || !this.isInside(toRow, toCol)) {
      return { isValid: false, reason: 'Tọa độ vượt ra ngoài phạm vi bàn cờ' };
    }

    if (fromRow === toRow && fromCol === toCol) {
      return { isValid: false, reason: 'Tọa độ đích trùng với tọa độ xuất phát' };
    }

    const sourcePiece = this.getPieceAt(fromRow, fromCol);
    if (!sourcePiece) {
      return { isValid: false, reason: 'Không có quân cờ ở ô xuất phát' };
    }

    if (sourcePiece.player !== playerNum) {
      return { isValid: false, reason: 'Không thể di chuyển quân cờ của đối phương' };
    }

    const targetCell = this.grid[toRow][toCol];

    // Cannot land on obstacle
    if (targetCell.item === ITEM_TYPES.OBSTACLE) {
      return { isValid: false, reason: 'Không thể di chuyển vào ô chướng ngại vật' };
    }

    // Cannot land on own piece
    if (targetCell.piece && targetCell.piece.player === playerNum) {
      return { isValid: false, reason: 'Không thể di chuyển đè lên quân cờ của chính mình' };
    }

    const dr = Math.abs(toRow - fromRow);
    const dc = Math.abs(toCol - fromCol);

    // Standard 1-step move: 1 tile orthogonally (up, down, left, right)
    const isSingleStep = (dr === 1 && dc === 0) || (dr === 0 && dc === 1);

    if (isSingleStep) {
      return { isValid: true };
    }

    // Speed Potion move (2 steps allowed)
    if (sourcePiece.hasSpeedBuff) {
      // 2 steps straight (horizontal or vertical)
      if ((dr === 2 && dc === 0) || (dr === 0 && dc === 2)) {
        // Intermediate cell must not be obstacle
        const midR = fromRow + (toRow - fromRow) / 2;
        const midC = fromCol + (toCol - fromCol) / 2;
        if (this.grid[midR][midC].item === ITEM_TYPES.OBSTACLE) {
          return { isValid: false, reason: 'Đường đi 2 bước bị chướng ngại vật chặn giữa' };
        }
        return { isValid: true };
      }

      // Diagonal 1-step equivalent (1 vertical + 1 horizontal)
      if (dr === 1 && dc === 1) {
        return { isValid: true };
      }
    }

    return { isValid: false, reason: 'Khoảng cách di chuyển không hợp lệ (Vượt quá số bước cho phép)' };
  }

  /**
   * Execute a move and record detailed Replay JSON step
   * @param {number} playerNum - 1 or 2
   * @param {Object} move - { fromRow, fromCol, toRow, toCol }
   * @param {number} [executionTimeMs=0] - Time taken to calculate move
   */
  executeMove(playerNum, move, executionTimeMs = 0) {
    if (this.isGameOver) {
      throw new Error(`[GameEngine] Trận đấu đã kết thúc (${this.winReason}). Không thể đi tiếp.`);
    }

    if (playerNum !== this.currentTurnPlayer) {
      throw new Error(`[GameEngine] Chưa tới lượt của Người chơi ${playerNum}.`);
    }

    let effectiveMove = move;
    let fallbackNotice = null;

    const validation = this.validateMove(playerNum, move);
    if (!validation.isValid) {
      if (this.allowFallback !== false) {
        // Fallback to best available legal move for this player
        const legalMoves = this.getValidMovesForPlayer(playerNum);
        if (legalMoves.length === 0) {
          this.isGameOver = true;
          this.winner = playerNum === 1 ? 2 : 1;
          this.winReason = WIN_REASONS.ELIMINATION;
          return {
            success: false,
            error: 'Không còn nước đi hợp lệ nào trên bàn cờ',
            isGameOver: true,
            winner: this.winner,
            winReason: this.winReason,
          };
        }

        const targetFlagR = playerNum === 1 ? this.size - 1 : 0;
        const targetFlagC = playerNum === 1 ? this.size - 1 : 0;

        // Prioritize: 1. Flag capture, 2. Eating enemy piece, 3. Taking potions, 4. Moving forward
        legalMoves.sort((a, b) => {
          let scoreA = 0;
          let scoreB = 0;
          if (a.toRow === targetFlagR && a.toCol === targetFlagC) scoreA += 1000;
          if (b.toRow === targetFlagR && b.toCol === targetFlagC) scoreB += 1000;

          const tA = this.grid[a.toRow][a.toCol];
          const tB = this.grid[b.toRow][b.toCol];

          if (tA.piece && tA.piece.player !== playerNum) {
            const srcPieceA = this.grid[a.fromRow][a.fromCol]?.piece;
            const duel = srcPieceA ? srcPieceA.evaluateCombat(tA.piece) : null;
            if (duel && duel.winner === 'ATTACKER') scoreA += 200;
            else if (duel && duel.winner === 'DRAW') scoreA += 50;
            else scoreA -= 50;
          }
          if (tB.piece && tB.piece.player !== playerNum) {
            const srcPieceB = this.grid[b.fromRow][b.fromCol]?.piece;
            const duel = srcPieceB ? srcPieceB.evaluateCombat(tB.piece) : null;
            if (duel && duel.winner === 'ATTACKER') scoreB += 200;
            else if (duel && duel.winner === 'DRAW') scoreB += 50;
            else scoreB -= 50;
          }

          if (tA.item && tA.item !== ITEM_TYPES.OBSTACLE) scoreA += 30;
          if (tB.item && tB.item !== ITEM_TYPES.OBSTACLE) scoreB += 30;

          const fwdA = playerNum === 1 ? a.toRow - a.fromRow : a.fromRow - a.toRow;
          const fwdB = playerNum === 1 ? b.toRow - b.fromRow : b.fromRow - b.toRow;
          scoreA += fwdA * 10;
          scoreB += fwdB * 10;

          return scoreB - scoreA;
        });

        effectiveMove = legalMoves[0];
        fallbackNotice = `Nước đi (${move?.fromRow ?? '?'}, ${move?.fromCol ?? '?'}) lỗi: ${validation.reason}. Hỗ trợ tự động đi (${effectiveMove.fromRow}, ${effectiveMove.fromCol}) ➔ (${effectiveMove.toRow}, ${effectiveMove.toCol})`;
      } else {
        // Strict forfeit without fallback
        this.isGameOver = true;
        this.winner = playerNum === 1 ? 2 : 1;
        this.winReason = WIN_REASONS.INVALID_MOVE;

        this.replay.push({
          step: ++this.turnCount,
          player: playerNum,
          move,
          error: validation.reason,
          executionTimeMs,
          boardSnapshot: this.getBoardSnapshot(),
          timestamp: Date.now(),
        });

        return {
          success: false,
          error: validation.reason,
          isGameOver: true,
          winner: this.winner,
          winReason: this.winReason,
        };
      }
    }

    const { fromRow, fromCol, toRow, toCol } = effectiveMove;
    const movingPiece = this.grid[fromRow][fromCol].piece;
    const targetCell = this.grid[toRow][toCol];

    let itemCollected = null;
    let cloneSpawned = null;
    let combatResult = null;

    // Check if target tile contains a Power-Up Potion
    if (targetCell.item && targetCell.item !== ITEM_TYPES.OBSTACLE) {
      const potionType = targetCell.item;
      itemCollected = { type: potionType, row: toRow, col: toCol };

      if (potionType === ITEM_TYPES.POTION_INFECTION) {
        // Bình Đồng Hóa: Piece acquires infection buff
        movingPiece.applyBuff(ITEM_TYPES.POTION_INFECTION);
      } else if (potionType === ITEM_TYPES.POTION_SPEED) {
        // Bình Tăng Tốc: Piece acquires speed buff
        movingPiece.applyBuff(ITEM_TYPES.POTION_SPEED);
      } else if (potionType === ITEM_TYPES.POTION_CLONE) {
        // Bình Sinh Sản: Immediately spawn 1 clone in adjacent free cell
        const spawnPos = this.findAdjacentEmptyTile(toRow, toCol);
        if (spawnPos) {
          const [sRow, sCol] = spawnPos;
          const clonedPiece = movingPiece.clone(null, sRow, sCol);
          this.grid[sRow][sCol].piece = clonedPiece;
          cloneSpawned = clonedPiece.toJSON();
        }
      }

      // Consume potion from board
      targetCell.item = null;
    }

    // Resolve Combat if target cell has enemy piece
    if (targetCell.piece && targetCell.piece.player !== playerNum) {
      const defender = targetCell.piece;
      const duel = movingPiece.evaluateCombat(defender);

      combatResult = {
        attacker: movingPiece.toJSON(),
        defender: defender.toJSON(),
        outcome: duel,
        converted: false,
      };

      if (duel === 'WIN') {
        if (movingPiece.hasInfectionBuff) {
          // Bình Đồng Hóa: Convert enemy piece to player's own team!
          defender.player = playerNum;
          defender.hasInfectionBuff = false;
          defender.hasSpeedBuff = false;
          combatResult.converted = true;
          movingPiece.consumeInfectionBuff(); // Consumed buff

          // Attacker stays in from position, or moves to adjacent free tile if needed
          // According to rule: "quân đối phương bị ăn sẽ biến thành quân của mình"
          // We place the newly converted piece under player's control on toRow, toCol,
          // and attacker advances into toRow, toCol if defender moves, OR attacker stays.
          // Standard implementation: attacker advances, converted defender spawns to nearest cell:
          const spawnLoc = this.findAdjacentEmptyTile(toRow, toCol) || [fromRow, fromCol];
          this.grid[spawnLoc[0]][spawnLoc[1]].piece = defender;
          defender.row = spawnLoc[0];
          defender.col = spawnLoc[1];

          this.grid[fromRow][fromCol].piece = null;
          this.grid[toRow][toCol].piece = movingPiece;
          movingPiece.row = toRow;
          movingPiece.col = toCol;
        } else {
          // Normal elimination: Defender eliminated, attacker advances
          this.grid[fromRow][fromCol].piece = null;
          this.grid[toRow][toCol].piece = movingPiece;
          movingPiece.row = toRow;
          movingPiece.col = toCol;
        }
      } else if (duel === 'LOSE') {
        // Attacker eliminated, defender survives
        this.grid[fromRow][fromCol].piece = null;
      } else {
        // Tie: Mutual destruction
        this.grid[fromRow][fromCol].piece = null;
        this.grid[toRow][toCol].piece = null;
      }
    } else {
      // Peaceful movement to empty cell
      this.grid[fromRow][fromCol].piece = null;
      this.grid[toRow][toCol].piece = movingPiece;
      movingPiece.row = toRow;
      movingPiece.col = toCol;
    }

    // Consume speed buff if used in this move
    const dr = Math.abs(toRow - fromRow);
    const dc = Math.abs(toCol - fromCol);
    if ((dr === 2 || dc === 2 || (dr === 1 && dc === 1)) && movingPiece.hasSpeedBuff) {
      movingPiece.consumeSpeedBuff();
    }

    this.turnCount++;

    // Check Flag Capture Win Condition (Cướp Cờ Căn Cứ Đối Phương)
    // Cờ P1 tại (0, 0) - Cờ P2 tại (rows-1, cols-1) e.g. (8, 8)
    const p1Flag = [0, 0];
    const p2Flag = [this.rows - 1, this.cols - 1];

    const pieceAtP2Flag = this.grid[p2Flag[0]][p2Flag[1]].piece;
    const pieceAtP1Flag = this.grid[p1Flag[0]][p1Flag[1]].piece;

    if (pieceAtP2Flag && pieceAtP2Flag.player === 1) {
      this.isGameOver = true;
      this.winner = 1;
      this.winReason = WIN_REASONS.FLAG_CAPTURE;
    } else if (pieceAtP1Flag && pieceAtP1Flag.player === 2) {
      this.isGameOver = true;
      this.winner = 2;
      this.winReason = WIN_REASONS.FLAG_CAPTURE;
    }

    // Check Infinite Loop (5 identical board hashes)
    const boardHash = this.computeBoardHash();
    const repCount = (this.boardStateHistory.get(boardHash) || 0) + 1;
    this.boardStateHistory.set(boardHash, repCount);

    if (!this.isGameOver && repCount >= 5) {
      this.isGameOver = true;
      this.winner = playerNum === 1 ? 2 : 1; // Offending player loses
      this.winReason = WIN_REASONS.INFINITE_LOOP;
    }

    // Check Piece Elimination
    const p1Count = this.getPiecesForPlayer(1).length;
    const p2Count = this.getPiecesForPlayer(2).length;

    if (!this.isGameOver) {
      if (p1Count === 0 && p2Count === 0) {
        this.isGameOver = true;
        this.winner = null;
        this.winReason = WIN_REASONS.DRAW;
      } else if (p1Count === 0) {
        this.isGameOver = true;
        this.winner = 2;
        this.winReason = WIN_REASONS.ELIMINATION;
      } else if (p2Count === 0) {
        this.isGameOver = true;
        this.winner = 1;
        this.winReason = WIN_REASONS.ELIMINATION;
      } else if (this.turnCount >= this.maxTurns) {
        // Max turns reached -> Winner is player with more surviving pieces
        this.isGameOver = true;
        this.winReason = WIN_REASONS.MAX_TURNS_REACHED;
        if (p1Count > p2Count) {
          this.winner = 1;
        } else if (p2Count > p1Count) {
          this.winner = 2;
        } else {
          this.winner = null; // Draw
        }
      }
    }

    // Append to Replay History
    const stepRecord = {
      step: this.turnCount,
      player: playerNum,
      move: effectiveMove,
      originalMove: move !== effectiveMove ? move : undefined,
      warning: fallbackNotice,
      itemCollected,
      cloneSpawned,
      combat: combatResult,
      executionTimeMs,
      boardSnapshot: this.getBoardSnapshot(),
      pieceCounts: { p1: p1Count, p2: p2Count },
      timestamp: Date.now(),
    };
    this.replay.push(stepRecord);

    // Switch turn
    this.currentTurnPlayer = this.currentTurnPlayer === 1 ? 2 : 1;

    return {
      success: true,
      step: stepRecord,
      isGameOver: this.isGameOver,
      winner: this.winner,
      winReason: this.winReason,
    };
  }

  /**
   * Get all active pieces for a player
   * @param {number} playerNum - 1 or 2
   * @returns {GamePiece[]}
   */
  getPiecesForPlayer(playerNum) {
    const list = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const piece = this.grid[r][c].piece;
        if (piece && piece.player === playerNum) {
          list.push(piece);
        }
      }
    }
    return list;
  }

  /**
   * Generate all legal moves available for player
   * @param {number} playerNum - 1 or 2
   * @returns {Array<{ fromRow: number, fromCol: number, toRow: number, toCol: number }>}
   */
  getValidMovesForPlayer(playerNum) {
    const validMoves = [];
    const pieces = this.getPiecesForPlayer(playerNum);

    const standardDeltas = [
      [-1, 0], [1, 0], [0, -1], [0, 1]
    ];
    const speedDeltas = [
      [-2, 0], [2, 0], [0, -2], [0, 2],
      [-1, -1], [-1, 1], [1, -1], [1, 1]
    ];

    for (const piece of pieces) {
      const { row: r, col: c } = piece;

      for (const [dr, dc] of standardDeltas) {
        const move = { fromRow: r, fromCol: c, toRow: r + dr, toCol: c + dc };
        if (this.validateMove(playerNum, move).isValid) {
          validMoves.push(move);
        }
      }

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
   * Compute deterministic board hash for repetition detection
   */
  computeBoardHash() {
    let hash = '';
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const tile = this.grid[r][c];
        if (tile.piece) {
          hash += `${tile.piece.player}${tile.piece.shortCode}${tile.piece.hasInfectionBuff ? 'I' : ''}${tile.piece.hasSpeedBuff ? 'S' : ''}|`;
        } else if (tile.item) {
          hash += `${tile.item[0]}|`;
        } else {
          hash += '.|';
        }
      }
    }
    return hash;
  }

  /**
   * Generate serializable snapshot of current board state
   */
  getBoardSnapshot() {
    const matrix = [];
    for (let r = 0; r < this.rows; r++) {
      const row = [];
      for (let c = 0; c < this.cols; c++) {
        const tile = this.grid[r][c];
        row.push({
          piece: tile.piece ? tile.piece.toJSON() : null,
          item: tile.item || null,
        });
      }
      matrix.push(row);
    }
    return matrix;
  }

  /**
   * Return entire replay array formatted for database storage & client playback
   */
  getReplayJson() {
    return {
      matchId: this.matchId,
      size: this.size,
      difficulty: this.difficulty,
      maxTurns: this.maxTurns,
      totalTurns: this.turnCount,
      winner: this.winner,
      winReason: this.winReason,
      mapConfig: this.mapConfig,
      flags: {
        p1: [0, 0],
        p2: [this.rows - 1, this.cols - 1],
      },
      initialBoard: this.initialBoardSnapshot || (this.replay.length > 0 ? this.replay[0].boardSnapshot : []),
      steps: this.replay,
    };
  }
}

module.exports = {
  GameEngine,
};
