/**
 * Tactical Rock-Paper-Scissors Board Game Core Engine
 * 
 * Rules:
 * - Board: 8x8 or 9x9 grid
 * - Pieces:
 *   - 'R' (Rock): Beats Scissors ('S'), loses to Paper ('P')
 *   - 'P' (Paper): Beats Rock ('R'), loses to Scissors ('S')
 *   - 'S' (Scissors): Beats Paper ('P'), loses to Rock ('R')
 *   - 'F' (Flag/Base): Cannot move, captured when opponent moves onto it.
 * - Combat:
 *   - Attacker vs Defender: Rock beats Scissors, Scissors beats Paper, Paper beats Rock.
 *   - Tie: Both combat pieces eliminated.
 *   - Capturing 'F': Instant win.
 */

const PIECE_TYPES = {
  ROCK: 'R',
  PAPER: 'P',
  SCISSORS: 'S',
  FLAG: 'F',
};

const BATTLE_RULES = {
  R: { S: 1, P: -1, R: 0, F: 1 },
  P: { R: 1, S: -1, P: 0, F: 1 },
  S: { P: 1, R: -1, S: 0, F: 1 },
};

/**
 * Initialize a board state from map configuration
 */
function createInitialBoard(mapConfig = {}) {
  const rows = mapConfig.rows || 8;
  const cols = mapConfig.cols || 8;
  const board = Array.from({ length: rows }, () => Array(cols).fill(null));

  // Default piece deployment for Player 1 (Top, row 0 and 1)
  const p1Spawns = [
    { r: 0, c: 0, type: 'R', player: 1 },
    { r: 0, c: 1, type: 'P', player: 1 },
    { r: 0, c: 2, type: 'S', player: 1 },
    { r: 0, c: 3, type: 'F', player: 1 }, // Flag
    { r: 0, c: 4, type: 'R', player: 1 },
    { r: 0, c: 5, type: 'P', player: 1 },
    { r: 0, c: 6, type: 'S', player: 1 },
    { r: 0, c: 7, type: 'R', player: 1 },
  ];

  // Default piece deployment for Player 2 (Bottom, row rows-1)
  const p2Row = rows - 1;
  const p2Spawns = [
    { r: p2Row, c: 0, type: 'R', player: 2 },
    { r: p2Row, c: 1, type: 'P', player: 2 },
    { r: p2Row, c: 2, type: 'S', player: 2 },
    { r: p2Row, c: 3, type: 'R', player: 2 },
    { r: p2Row, c: 4, type: 'F', player: 2 }, // Flag
    { r: p2Row, c: 5, type: 'P', player: 2 },
    { r: p2Row, c: 6, type: 'S', player: 2 },
    { r: p2Row, c: 7, type: 'R', player: 2 },
  ];

  for (const piece of p1Spawns) {
    if (piece.r < rows && piece.c < cols) {
      board[piece.r][piece.c] = piece;
    }
  }

  for (const piece of p2Spawns) {
    if (piece.r < rows && piece.c < cols) {
      board[piece.r][piece.c] = piece;
    }
  }

  // Set obstacles
  if (Array.isArray(mapConfig.obstacles)) {
    for (const [r, c] of mapConfig.obstacles) {
      if (r < rows && c < cols) {
        board[r][c] = { type: 'OBSTACLE', player: 0 };
      }
    }
  }

  return { rows, cols, grid: board };
}

/**
 * Validate a move
 */
function isValidMove(boardState, playerNum, move) {
  if (!move || typeof move !== 'object') return false;
  const { fromRow, fromCol, toRow, toCol } = move;

  const { rows, cols, grid } = boardState;
  if (fromRow < 0 || fromRow >= rows || fromCol < 0 || fromCol >= cols) return false;
  if (toRow < 0 || toRow >= rows || toCol < 0 || toCol >= cols) return false;

  const piece = grid[fromRow][fromCol];
  if (!piece || piece.player !== playerNum) return false;
  if (piece.type === 'F' || piece.type === 'OBSTACLE') return false; // Flag & Obstacle cannot move

  // Orthogonal movement (1 step up, down, left, right)
  const dr = Math.abs(toRow - fromRow);
  const dc = Math.abs(toCol - fromCol);
  if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
    const targetCell = grid[toRow][toCol];
    if (targetCell && targetCell.player === playerNum) return false; // Cannot land on own piece
    if (targetCell && targetCell.type === 'OBSTACLE') return false; // Cannot land on obstacle
    return true;
  }

  return false;
}

/**
 * Execute a validated move and return events
 */
function executeMove(boardState, playerNum, move) {
  const { fromRow, fromCol, toRow, toCol } = move;
  const attacker = boardState.grid[fromRow][fromCol];
  const defender = boardState.grid[toRow][toCol];

  boardState.grid[fromRow][fromCol] = null;
  const event = {
    turn: playerNum,
    from: [fromRow, fromCol],
    to: [toRow, toCol],
    attacker: { ...attacker },
    defender: defender ? { ...defender } : null,
    outcome: 'MOVE',
  };

  if (!defender) {
    boardState.grid[toRow][toCol] = attacker;
    return event;
  }

  // Combat or Flag Capture occurs
  const size = boardState.grid.length;
  if ((playerNum === 1 && toRow === size - 1 && toCol === size - 1) ||
      (playerNum === 2 && toRow === 0 && toCol === 0) ||
      (defender && defender.type === 'F')) {
    // Flag captured!
    boardState.grid[toRow][toCol] = attacker;
    event.outcome = 'FLAG_CAPTURED';
    return event;
  }

  const duelResult = BATTLE_RULES[attacker.type]?.[defender.type] ?? 0;
  if (duelResult > 0) {
    // Attacker wins
    boardState.grid[toRow][toCol] = attacker;
    event.outcome = 'ATTACKER_WON';
  } else if (duelResult < 0) {
    // Defender wins
    boardState.grid[toRow][toCol] = defender;
    event.outcome = 'DEFENDER_WON';
  } else {
    // Tie: Mutual destruction
    boardState.grid[toRow][toCol] = null;
    event.outcome = 'MUTUAL_DESTRUCTION';
  }

  return event;
}

/**
 * Check if a player has any movable pieces left or flag alive
 */
function checkPlayerStatus(boardState, playerNum) {
  let hasFlag = false;
  let movablePieceCount = 0;

  for (let r = 0; r < boardState.rows; r++) {
    for (let c = 0; c < boardState.cols; c++) {
      const piece = boardState.grid[r][c];
      if (piece && piece.player === playerNum) {
        if (piece.type === 'F') hasFlag = true;
        else movablePieceCount++;
      }
    }
  }

  return { hasFlag, movablePieceCount, isAlive: hasFlag && movablePieceCount > 0 };
}

module.exports = {
  PIECE_TYPES,
  createInitialBoard,
  isValidMove,
  executeMove,
  checkPlayerStatus,
};
