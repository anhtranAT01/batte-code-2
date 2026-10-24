/**
 * GamePiece Class - Represents an active piece on the tactical board
 */

const { PIECE_TYPES, PIECE_SHORT_CODES, COMBAT_ADVANTAGE } = require('./constants');

class GamePiece {
  /**
   * @param {Object} params
   * @param {string} [params.id] - Unique piece identifier
   * @param {number} params.player - Player 1 or 2
   * @param {'ROCK'|'PAPER'|'SCISSORS'} params.type - Piece type
   * @param {number} [params.row] - Board row
   * @param {number} [params.col] - Board col
   * @param {boolean} [params.hasInfectionBuff=false] - Infection potion active
   * @param {boolean} [params.hasSpeedBuff=false] - Speed potion active
   */
  constructor({
    id,
    player,
    type,
    row = null,
    col = null,
    hasInfectionBuff = false,
    hasSpeedBuff = false,
  }) {
    if (!PIECE_TYPES[type]) {
      throw new Error(`[GamePiece] Invalid piece type: ${type}. Must be ROCK, PAPER, or SCISSORS.`);
    }
    if (player !== 1 && player !== 2) {
      throw new Error(`[GamePiece] Invalid player: ${player}. Must be 1 or 2.`);
    }

    this.id = id || `piece_p${player}_${type}_${Math.random().toString(36).substring(2, 8)}`;
    this.player = player;
    this.type = type;
    this.row = row;
    this.col = col;

    // Power-up statuses
    this.hasInfectionBuff = Boolean(hasInfectionBuff); // Bình Đồng Hóa
    this.hasSpeedBuff = Boolean(hasSpeedBuff);         // Bình Tăng Tốc
  }

  /**
   * Short letter representation for compact serializations (R, P, S)
   */
  get shortCode() {
    return PIECE_SHORT_CODES[this.type] || this.type[0];
  }

  /**
   * Combat calculation against another piece
   * @param {GamePiece} defender
   * @returns {'WIN'|'LOSE'|'TIE'}
   */
  evaluateCombat(defender) {
    if (!defender || !(defender instanceof GamePiece)) {
      throw new Error('[GamePiece] Target defender must be a valid GamePiece instance.');
    }

    if (this.type === defender.type) {
      return 'TIE';
    }

    const advantage = COMBAT_ADVANTAGE[this.type]?.[defender.type] ?? 0;
    if (advantage > 0) {
      return 'WIN';
    } else if (advantage < 0) {
      return 'LOSE';
    }
    return 'TIE';
  }

  /**
   * Apply a collected power-up item
   * @param {'POTION_INFECTION'|'POTION_SPEED'} itemType
   */
  applyBuff(itemType) {
    if (itemType === 'POTION_INFECTION') {
      this.hasInfectionBuff = true;
    } else if (itemType === 'POTION_SPEED') {
      this.hasSpeedBuff = true;
    }
  }

  /**
   * Clear buffs after activation
   */
  consumeInfectionBuff() {
    this.hasInfectionBuff = false;
  }

  consumeSpeedBuff() {
    this.hasSpeedBuff = false;
  }

  /**
   * Create an identical clone (for Clone Potion or simulation)
   */
  clone(newId = null, newRow = null, newCol = null) {
    return new GamePiece({
      id: newId || `clone_${this.id}_${Math.random().toString(36).substring(2, 6)}`,
      player: this.player,
      type: this.type,
      row: newRow !== null ? newRow : this.row,
      col: newCol !== null ? newCol : this.col,
      hasInfectionBuff: this.hasInfectionBuff,
      hasSpeedBuff: this.hasSpeedBuff,
    });
  }

  /**
   * Plain object representation for JSON serialization & Replay JSON
   */
  toJSON() {
    return {
      id: this.id,
      player: this.player,
      type: this.type,
      shortCode: this.shortCode,
      row: this.row,
      col: this.col,
      hasInfectionBuff: this.hasInfectionBuff,
      hasSpeedBuff: this.hasSpeedBuff,
    };
  }
}

module.exports = {
  GamePiece,
};
