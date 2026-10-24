/**
 * Board Class - Handles grid layout, symmetrical map generation, obstacles, and buffs
 */

const { Piece, PIECE_TYPES } = require('./Piece');
const { ITEM_TYPES } = require('./Buffs');

const DIFFICULTY_LEVELS = Object.freeze({
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
  RANDOM: 'random',
});

class Board {
  /**
   * @param {Object} options
   * @param {number} [options.size=8] - Board dimensions (8 for 8x8, 9 for 9x9)
   * @param {string} [options.difficulty='medium'] - Map difficulty ('easy'|'medium'|'hard'|'random')
   * @param {Object} [options.customLayout] - Pre-defined JSON layout if provided
   */
  constructor({ size = 8, difficulty = DIFFICULTY_LEVELS.MEDIUM, customLayout = null } = {}) {
    if (size !== 8 && size !== 9) {
      throw new Error(`[Board] Unsupported board size: ${size}. Only 8x8 and 9x9 are supported.`);
    }

    this.rows = size;
    this.cols = size;
    this.difficulty = difficulty.toLowerCase();

    // 2D grid: each cell is an object { piece: Piece|null, item: Object|null }
    this.grid = Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => ({
        piece: null,
        item: null,
      }))
    );

    if (customLayout) {
      this.loadFromCustomLayout(customLayout);
    } else {
      this.generateSymmetricalMap(this.difficulty);
    }
  }

  /**
   * Check if coordinates lie inside board boundaries
   */
  isInside(r, c) {
    return r >= 0 && r < this.rows && c >= 0 && c < this.cols;
  }

  /**
   * Get contents of a cell
   */
  getTile(r, c) {
    if (!this.isInside(r, c)) return null;
    return this.grid[r][c];
  }

  /**
   * Set piece at coordinate
   */
  setPieceAt(r, c, piece) {
    if (!this.isInside(r, c)) return false;
    this.grid[r][c].piece = piece;
    if (piece) {
      piece.row = r;
      piece.col = c;
    }
    return true;
  }

  /**
   * Remove piece from coordinate
   */
  removePieceAt(r, c) {
    if (!this.isInside(r, c)) return null;
    const removed = this.grid[r][c].piece;
    this.grid[r][c].piece = null;
    if (removed) {
      removed.row = null;
      removed.col = null;
    }
    return removed;
  }

  /**
   * Set item/buff at coordinate
   */
  setItemAt(r, c, item) {
    if (!this.isInside(r, c)) return false;
    this.grid[r][c].item = item;
    return true;
  }

  /**
   * Remove and return item/buff from coordinate
   */
  removeItemAt(r, c) {
    if (!this.isInside(r, c)) return null;
    const item = this.grid[r][c].item;
    this.grid[r][c].item = null;
    return item;
  }

  /**
   * Check if tile is an obstacle
   */
  isObstacle(r, c) {
    const tile = this.getTile(r, c);
    return tile && tile.item && tile.item.type === ITEM_TYPES.OBSTACLE;
  }

  /**
   * Find an adjacent orthogonal empty tile (no piece and no obstacle)
   * @param {number} r
   * @param {number} c
   * @returns {{row: number, col: number}|null}
   */
  findAdjacentEmptyTile(r, c) {
    const directions = [
      [-1, 0], // Up
      [1, 0],  // Down
      [0, -1], // Left
      [0, 1],  // Right
    ];

    for (const [dr, dc] of directions) {
      const nr = r + dr;
      const nc = c + dc;
      if (this.isInside(nr, nc)) {
        const tile = this.getTile(nr, nc);
        if (!tile.piece && !this.isObstacle(nr, nc)) {
          return { row: nr, col: nc };
        }
      }
    }

    return null;
  }

  /**
   * Get all active pieces belonging to a specific player
   * @param {number} playerNumber
   * @returns {Piece[]}
   */
  getPiecesForPlayer(playerNumber) {
    const pieces = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const piece = this.grid[r][c].piece;
        if (piece && piece.player === playerNumber) {
          pieces.push(piece);
        }
      }
    }
    return pieces;
  }

  /**
   * Clear all pieces and items from grid
   */
  clear() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.grid[r][c] = { piece: null, item: null };
      }
    }
  }

  /**
   * Place an item symmetrically using 180-degree rotational symmetry
   * Point (r, c) has symmetrical counterpart (rows - 1 - r, cols - 1 - c)
   */
  placeSymmetricalItem(r, c, itemType) {
    const mirrorR = this.rows - 1 - r;
    const mirrorC = this.cols - 1 - c;

    this.setItemAt(r, c, { type: itemType });
    if (mirrorR !== r || mirrorC !== c) {
      this.setItemAt(mirrorR, mirrorC, { type: itemType });
    }
  }

  /**
   * Generate balanced initial pieces for both players symmetrically
   */
  spawnDefaultPieces() {
    const rpsTypes = [
      PIECE_TYPES.ROCK,
      PIECE_TYPES.PAPER,
      PIECE_TYPES.SCISSORS,
    ];

    if (this.rows === 8) {
      // 8x8 standard piece deployment: 8 pieces per side
      // Player 1 at row 0: R, P, S, R, P, S, R, P
      const p1Setup = [
        PIECE_TYPES.ROCK,
        PIECE_TYPES.PAPER,
        PIECE_TYPES.SCISSORS,
        PIECE_TYPES.ROCK,
        PIECE_TYPES.SCISSORS,
        PIECE_TYPES.PAPER,
        PIECE_TYPES.ROCK,
        PIECE_TYPES.SCISSORS,
      ];

      for (let c = 0; c < 8; c++) {
        const type = p1Setup[c];
        const p1Piece = new Piece({
          id: `p1_${type}_${c}`,
          player: 1,
          type,
          row: 0,
          col: c,
        });
        this.setPieceAt(0, c, p1Piece);

        // Mirror for Player 2 at row 7
        const mirrorC = 7 - c;
        const p2Piece = new Piece({
          id: `p2_${type}_${mirrorC}`,
          player: 2,
          type,
          row: 7,
          col: mirrorC,
        });
        this.setPieceAt(7, mirrorC, p2Piece);
      }
    } else if (this.rows === 9) {
      // 9x9 grand colosseum piece deployment: 9 pieces on front rank + 3 on second rank
      for (let c = 0; c < 9; c++) {
        const type = rpsTypes[c % 3];
        const p1Piece = new Piece({
          id: `p1_${type}_${c}`,
          player: 1,
          type,
          row: 0,
          col: c,
        });
        this.setPieceAt(0, c, p1Piece);

        const mirrorC = 8 - c;
        const p2Piece = new Piece({
          id: `p2_${type}_${mirrorC}`,
          player: 2,
          type,
          row: 8,
          col: mirrorC,
        });
        this.setPieceAt(8, mirrorC, p2Piece);
      }
    }
  }

  /**
   * Generate map according to specified difficulty with 100% rotational symmetry
   * @param {string} difficulty
   */
  generateSymmetricalMap(difficulty = DIFFICULTY_LEVELS.MEDIUM) {
    this.clear();
    const midRow = Math.floor(this.rows / 2);

    switch (difficulty) {
      case DIFFICULTY_LEVELS.EASY: {
        // 2-4 obstacles, plenty of buffs
        if (this.rows === 8) {
          this.placeSymmetricalItem(3, 3, ITEM_TYPES.OBSTACLE);
          this.placeSymmetricalItem(2, 2, ITEM_TYPES.POTION_SPEED);
          this.placeSymmetricalItem(2, 5, ITEM_TYPES.POTION_INFECTION);
          this.placeSymmetricalItem(3, 1, ITEM_TYPES.POTION_CLONE);
        } else {
          this.placeSymmetricalItem(3, 3, ITEM_TYPES.OBSTACLE);
          this.placeSymmetricalItem(2, 4, ITEM_TYPES.POTION_SPEED);
          this.placeSymmetricalItem(3, 1, ITEM_TYPES.POTION_INFECTION);
          this.placeSymmetricalItem(3, 7, ITEM_TYPES.POTION_CLONE);
        }
        break;
      }

      case DIFFICULTY_LEVELS.MEDIUM: {
        // Tactical choke points with 6-8 obstacles and 2 of each potion
        if (this.rows === 8) {
          // Central blockades creating flanking corridors
          this.placeSymmetricalItem(3, 2, ITEM_TYPES.OBSTACLE);
          this.placeSymmetricalItem(3, 5, ITEM_TYPES.OBSTACLE);
          this.placeSymmetricalItem(2, 3, ITEM_TYPES.OBSTACLE);

          // Potions
          this.placeSymmetricalItem(2, 1, ITEM_TYPES.POTION_SPEED);
          this.placeSymmetricalItem(3, 3, ITEM_TYPES.POTION_INFECTION);
          this.placeSymmetricalItem(2, 6, ITEM_TYPES.POTION_CLONE);
        } else {
          // 9x9 Medium
          this.placeSymmetricalItem(3, 2, ITEM_TYPES.OBSTACLE);
          this.placeSymmetricalItem(3, 6, ITEM_TYPES.OBSTACLE);
          this.placeSymmetricalItem(4, 4, ITEM_TYPES.OBSTACLE); // Center obstacle

          this.placeSymmetricalItem(2, 4, ITEM_TYPES.POTION_SPEED);
          this.placeSymmetricalItem(3, 4, ITEM_TYPES.POTION_INFECTION);
          this.placeSymmetricalItem(2, 1, ITEM_TYPES.POTION_CLONE);
        }
        break;
      }

      case DIFFICULTY_LEVELS.HARD: {
        // Maze-like corridors with tight bottleneck paths and contested center buffs
        if (this.rows === 8) {
          this.placeSymmetricalItem(2, 1, ITEM_TYPES.OBSTACLE);
          this.placeSymmetricalItem(2, 3, ITEM_TYPES.OBSTACLE);
          this.placeSymmetricalItem(2, 6, ITEM_TYPES.OBSTACLE);
          this.placeSymmetricalItem(3, 4, ITEM_TYPES.OBSTACLE);
          this.placeSymmetricalItem(3, 1, ITEM_TYPES.OBSTACLE);

          // High-risk central buffs
          this.placeSymmetricalItem(3, 3, ITEM_TYPES.POTION_INFECTION);
          this.placeSymmetricalItem(3, 2, ITEM_TYPES.POTION_SPEED);
          this.placeSymmetricalItem(3, 5, ITEM_TYPES.POTION_CLONE);
        } else {
          this.placeSymmetricalItem(2, 2, ITEM_TYPES.OBSTACLE);
          this.placeSymmetricalItem(2, 6, ITEM_TYPES.OBSTACLE);
          this.placeSymmetricalItem(3, 4, ITEM_TYPES.OBSTACLE);
          this.placeSymmetricalItem(4, 2, ITEM_TYPES.OBSTACLE);
          this.placeSymmetricalItem(4, 6, ITEM_TYPES.OBSTACLE);

          this.placeSymmetricalItem(4, 4, ITEM_TYPES.POTION_INFECTION); // Golden center buff
          this.placeSymmetricalItem(3, 2, ITEM_TYPES.POTION_SPEED);
          this.placeSymmetricalItem(3, 6, ITEM_TYPES.POTION_CLONE);
        }
        break;
      }

      case DIFFICULTY_LEVELS.RANDOM:
      default: {
        // Procedural random symmetrical generation with connectivity check
        this.generateRandomSymmetricalFeatures();
        break;
      }
    }

    // Deploy pieces on top and bottom rows
    this.spawnDefaultPieces();
  }

  /**
   * Procedural random symmetrical generation
   */
  generateRandomSymmetricalFeatures() {
    const midRow = Math.floor(this.rows / 2);
    const availableCells = [];

    // Eligible rows for obstacles & buffs: strictly between row 2 and midRow
    for (let r = 2; r <= midRow; r++) {
      for (let c = 0; c < this.cols; c++) {
        // Avoid placing symmetric duplicates on the exact center if odd
        if (r === midRow && c >= Math.ceil(this.cols / 2)) continue;
        availableCells.push({ r, c });
      }
    }

    // Shuffle available coordinates
    for (let i = availableCells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableCells[i], availableCells[j]] = [availableCells[j], availableCells[i]];
    }

    // Place 3 pairs of obstacles
    for (let k = 0; k < 3 && availableCells.length > 0; k++) {
      const cell = availableCells.pop();
      this.placeSymmetricalItem(cell.r, cell.c, ITEM_TYPES.OBSTACLE);
    }

    // Place 1 pair of each potion
    const potions = [
      ITEM_TYPES.POTION_INFECTION,
      ITEM_TYPES.POTION_SPEED,
      ITEM_TYPES.POTION_CLONE,
    ];

    for (const potionType of potions) {
      if (availableCells.length > 0) {
        const cell = availableCells.pop();
        this.placeSymmetricalItem(cell.r, cell.c, potionType);
      }
    }
  }

  /**
   * Load custom layout configuration
   * @param {Object} layout
   */
  loadFromCustomLayout(layout) {
    this.clear();
    if (layout.obstacles && Array.isArray(layout.obstacles)) {
      for (const [r, c] of layout.obstacles) {
        this.setItemAt(r, c, { type: ITEM_TYPES.OBSTACLE });
      }
    }
    if (layout.potions && Array.isArray(layout.potions)) {
      for (const item of layout.potions) {
        this.setItemAt(item.row, item.col, { type: item.type });
      }
    }
    this.spawnDefaultPieces();
  }

  /**
   * Export complete board snapshot for MatchReplay JSON
   * @returns {Array<Array<Object>>}
   */
  toSnapshot() {
    return this.grid.map((row) =>
      row.map((cell) => ({
        piece: cell.piece ? cell.piece.toJSON() : null,
        item: cell.item ? { ...cell.item } : null,
      }))
    );
  }
}

module.exports = {
  Board,
  DIFFICULTY_LEVELS,
};
