/**
 * Buffs & Special Tile Definitions and Handlers
 */

const ITEM_TYPES = Object.freeze({
  OBSTACLE: 'OBSTACLE',
  POTION_INFECTION: 'POTION_INFECTION', // Buff Đồng hóa
  POTION_SPEED: 'POTION_SPEED',         // Buff Tăng tốc
  POTION_CLONE: 'POTION_CLONE',         // Buff Sinh sản
});

const ITEM_ICONS = Object.freeze({
  OBSTACLE: '⬛',
  POTION_INFECTION: '🧪',
  POTION_SPEED: '⚡',
  POTION_CLONE: '🧬',
});

class BuffManager {
  /**
   * Check if a board cell has a consumable potion/buff
   * @param {Object} item
   * @returns {boolean}
   */
  static isConsumableBuff(item) {
    if (!item) return false;
    return (
      item.type === ITEM_TYPES.POTION_INFECTION ||
      item.type === ITEM_TYPES.POTION_SPEED ||
      item.type === ITEM_TYPES.POTION_CLONE
    );
  }

  /**
   * Process buff pickup when a piece steps onto a buff tile
   * @param {Piece} piece - The piece consuming the buff
   * @param {Object} item - The item on the tile
   * @param {Board} board - Board reference for clone spawning
   * @returns {Object} Event details describing the buff effect
   */
  static applyBuff(piece, item, board) {
    if (!piece || !item) return null;

    const event = {
      type: item.type,
      pieceId: piece.id,
      player: piece.player,
      position: [piece.row, piece.col],
      description: '',
      clonedPiece: null,
    };

    switch (item.type) {
      case ITEM_TYPES.POTION_INFECTION: {
        piece.applyInfectionBuff();
        event.description = `Quân ${piece.type} (P${piece.player}) nhận Buff Đồng Hóa (Infection): Lần ăn quân kế tiếp sẽ biến quân địch thành quân mình!`;
        break;
      }

      case ITEM_TYPES.POTION_SPEED: {
        piece.applySpeedBuff();
        event.description = `Quân ${piece.type} (P${piece.player}) nhận Buff Tăng Tốc (Speed): Được phép di chuyển tối đa 2 bước trong lượt này!`;
        break;
      }

      case ITEM_TYPES.POTION_CLONE: {
        // Find adjacent empty tile to spawn cloned piece
        const emptyTile = board.findAdjacentEmptyTile(piece.row, piece.col);
        if (emptyTile) {
          const clonedPiece = piece.clone();
          clonedPiece.row = emptyTile.row;
          clonedPiece.col = emptyTile.col;
          // New clone doesn't inherit consumable speed buff to prevent infinite loops
          clonedPiece.hasSpeedBuff = false;
          board.setPieceAt(emptyTile.row, emptyTile.col, clonedPiece);

          event.clonedPiece = clonedPiece.toJSON();
          event.description = `Quân ${piece.type} (P${piece.player}) nhận Buff Sinh Sản (Clone): Phân thân tạo thêm 1 quân ${piece.type} tại ô [${emptyTile.row}, ${emptyTile.col}]!`;
        } else {
          event.description = `Quân ${piece.type} (P${piece.player}) nhận Buff Sinh Sản nhưng xung quanh không có ô trống để phân thân.`;
        }
        break;
      }

      default:
        return null;
    }

    return event;
  }
}

module.exports = {
  ITEM_TYPES,
  ITEM_ICONS,
  BuffManager,
};
