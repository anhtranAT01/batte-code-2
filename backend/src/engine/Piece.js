/**
 * Piece Class - Represents a tactical Rock-Paper-Scissors piece on the board
 */

const PIECE_TYPES = Object.freeze({
  ROCK: 'ROCK',
  PAPER: 'PAPER',
  SCISSORS: 'SCISSORS',
});

// Short identifiers used in compact board views
const TYPE_SHORT_CODES = Object.freeze({
  ROCK: 'R',
  PAPER: 'P',
  SCISSORS: 'S',
});

class Piece {
  /**
   * @param {Object} options
   * @param {string} options.id - Unique piece identifier
   * @param {number} options.player - 1 (Player 1) or 2 (Player 2)
   * @param {'ROCK'|'PAPER'|'SCISSORS'} options.type - Combat type
   * @param {number} [options.row] - Current row coordinate
   * @param {number} [options.col] - Current col coordinate
   */
  constructor({ id, player, type, row = null, col = null }) {
    if (!PIECE_TYPES[type]) {
      throw new Error(`[Piece] Invalid piece type: ${type}. Must be ROCK, PAPER, or SCISSORS.`);
    }
    if (player !== 1 && player !== 2) {
      throw new Error(`[Piece] Invalid player: ${player}. Must be 1 or 2.`);
    }

    this.id = id || `p${player}_${type}_${Math.random().toString(36).substring(2, 8)}`;
    this.player = player;
    this.type = type;
    this.row = row;
    this.col = col;

    // Active buff statuses
    this.hasInfectionBuff = false; // Next captured enemy piece is converted instead of killed
    this.hasSpeedBuff = false;     // Can move up to 2 tiles in a turn
  }

  /**
   * Evaluate combat outcome against an opponent piece
   * @param {Piece} targetPiece
   * @returns {'WIN'|'LOSE'|'TIE'}
   */
  evaluateCombat(targetPiece) {
    if (!targetPiece || !(targetPiece instanceof Piece)) {
      throw new Error('[Piece] Combat target must be a valid Piece instance.');
    }

    if (this.type === targetPiece.type) {
      return 'TIE';
    }

    if (
      (this.type === PIECE_TYPES.ROCK && targetPiece.type === PIECE_TYPES.SCISSORS) ||
      (this.type === PIECE_TYPES.SCISSORS && targetPiece.type === PIECE_TYPES.PAPER) ||
      (this.type === PIECE_TYPES.PAPER && targetPiece.type === PIECE_TYPES.ROCK)
    ) {
      return 'WIN';
    }

    return 'LOSE';
  }

  /**
   * Apply Infection Potion (Đồng Hóa)
   */
  applyInfectionBuff() {
    this.hasInfectionBuff = true;
  }

  /**
   * Consume and clear Infection Potion after successful capture
   */
  consumeInfectionBuff() {
    const wasActive = this.hasInfectionBuff;
    this.hasInfectionBuff = false;
    return wasActive;
  }

  /**
   * Apply Speed Potion (Tăng Tốc)
   */
  applySpeedBuff() {
    this.hasSpeedBuff = true;
  }

  /**
   * Consume and clear Speed Potion
   */
  consumeSpeedBuff() {
    const wasActive = this.hasSpeedBuff;
    this.hasSpeedBuff = false;
    return wasActive;
  }

  /**
   * Convert piece ownership (used during infection buff trigger)
   * @param {number} newPlayerNumber
   */
  convertOwnership(newPlayerNumber) {
    this.player = newPlayerNumber;
    this.hasInfectionBuff = false;
    this.hasSpeedBuff = false;
  }

  /**
   * Clone piece to create an exact or new instance
   * @param {string} [newId]
   * @returns {Piece}
   */
  clone(newId = null) {
    const cloned = new Piece({
      id: newId || `p${this.player}_${this.type}_clone_${Math.random().toString(36).substring(2, 8)}`,
      player: this.player,
      type: this.type,
      row: this.row,
      col: this.col,
    });
    cloned.hasInfectionBuff = this.hasInfectionBuff;
    cloned.hasSpeedBuff = this.hasSpeedBuff;
    return cloned;
  }

  /**
   * Export JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      player: this.player,
      type: this.type,
      shortCode: TYPE_SHORT_CODES[this.type],
      row: this.row,
      col: this.col,
      buffs: {
        hasInfectionBuff: this.hasInfectionBuff,
        hasSpeedBuff: this.hasSpeedBuff,
      },
    };
  }
}

module.exports = {
  Piece,
  PIECE_TYPES,
  TYPE_SHORT_CODES,
};
