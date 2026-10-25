/**
 * Tactical Rock-Paper-Scissors Game Constants
 */

const BOARD_SIZES = Object.freeze({
  SIZE_8: 8,
  SIZE_9: 9,
});

const PIECE_TYPES = Object.freeze({
  ROCK: 'ROCK',
  PAPER: 'PAPER',
  SCISSORS: 'SCISSORS',
});

const PIECE_SHORT_CODES = Object.freeze({
  ROCK: 'R',
  PAPER: 'P',
  SCISSORS: 'S',
});

const ITEM_TYPES = Object.freeze({
  OBSTACLE: 'OBSTACLE',                   // Chướng ngại vật không thể đi qua
  POTION_INFECTION: 'POTION_INFECTION',   // Bình Đồng Hóa: Biến quân bị ăn thành quân mình
  POTION_SPEED: 'POTION_SPEED',           // Bình Tăng Tốc: Di chuyển 2 bước trong lượt
  POTION_CLONE: 'POTION_CLONE',           // Bình Sinh Sản: Tạo thêm 1 quân cờ ở ô liền kề
});

const DIFFICULTY_LEVELS = Object.freeze({
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
  RANDOM: 'random',
});

const BOT_LEVELS = Object.freeze({
  EASY: 'EASY',
  MEDIUM: 'MEDIUM',
  HARD: 'HARD',
  GRANDMASTER: 'GRANDMASTER',
});

// Combat advantage matrix: 1 = attacker wins, -1 = attacker loses, 0 = tie
const COMBAT_ADVANTAGE = Object.freeze({
  ROCK: {
    SCISSORS: 1,
    PAPER: -1,
    ROCK: 0,
  },
  PAPER: {
    ROCK: 1,
    SCISSORS: -1,
    PAPER: 0,
  },
  SCISSORS: {
    PAPER: 1,
    ROCK: -1,
    SCISSORS: 0,
  },
});

const WIN_REASONS = Object.freeze({
  FLAG_CAPTURE: 'FLAG_CAPTURE',           // Cướp cờ đối phương thành công tại ô căn cứ (0,0) hoặc (8,8)
  ELIMINATION: 'ELIMINATION',             // Diệt sạch toàn bộ quân cờ đối phương
  MAX_TURNS_REACHED: 'MAX_TURNS_REACHED', // Hết số lượt quy định, bên nhiều quân hơn thắng
  TIMEOUT: 'TIMEOUT',                     // Quá thời gian quy định cho một lượt đi
  INVALID_MOVE: 'INVALID_MOVE',           // Nước đi phạm quy
  INFINITE_LOOP: 'INFINITE_LOOP',         // Lặp lại trạng thái bàn cờ 5 lần liên tiếp
  DRAW: 'DRAW',                           // Hòa cờ
  SURRENDER: 'SURRENDER',                 // Đầu hàng
});

module.exports = {
  BOARD_SIZES,
  PIECE_TYPES,
  PIECE_SHORT_CODES,
  ITEM_TYPES,
  DIFFICULTY_LEVELS,
  BOT_LEVELS,
  COMBAT_ADVANTAGE,
  WIN_REASONS,
};
