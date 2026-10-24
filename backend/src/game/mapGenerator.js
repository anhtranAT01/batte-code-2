/**
 * Map Generator Module
 * Generates fair, symmetrical tactical boards for 8x8 and 9x9 dimensions
 * across Easy, Medium, Hard, and Random difficulties.
 */

const { BOARD_SIZES, DIFFICULTY_LEVELS, ITEM_TYPES, PIECE_TYPES } = require('./constants');
const { GamePiece } = require('./piece');

/**
 * Returns symmetrical pair coordinate using 180-degree rotational symmetry
 * @param {number} r - Row index
 * @param {number} c - Column index
 * @param {number} size - Board dimension (8 or 9)
 * @returns {[number, number]}
 */
function getSymmetricalPair(r, c, size) {
  return [size - 1 - r, size - 1 - c];
}

/**
 * Standard piece setup template for Row 0 (Player 1)
 */
function getInitialSpawnTypes(size) {
  if (size === 8) {
    return [
      PIECE_TYPES.ROCK,
      PIECE_TYPES.PAPER,
      PIECE_TYPES.SCISSORS,
      PIECE_TYPES.ROCK,
      PIECE_TYPES.SCISSORS,
      PIECE_TYPES.PAPER,
      PIECE_TYPES.ROCK,
      PIECE_TYPES.SCISSORS,
    ];
  }
  // 9x9 board: 3 Rocks, 3 Papers, 3 Scissors
  return [
    PIECE_TYPES.ROCK,
    PIECE_TYPES.PAPER,
    PIECE_TYPES.SCISSORS,
    PIECE_TYPES.ROCK,
    PIECE_TYPES.PAPER,
    PIECE_TYPES.SCISSORS,
    PIECE_TYPES.ROCK,
    PIECE_TYPES.PAPER,
    PIECE_TYPES.SCISSORS,
  ];
}

/**
 * Pre-defined obstacle configurations by difficulty
 */
const OBSTACLE_PRESETS = {
  8: {
    [DIFFICULTY_LEVELS.EASY]: [
      [3, 2], [4, 5],
      [3, 5], [4, 2],
    ],
    [DIFFICULTY_LEVELS.MEDIUM]: [
      [3, 1], [4, 6],
      [3, 3], [4, 4],
      [3, 6], [4, 1],
    ],
    [DIFFICULTY_LEVELS.HARD]: [
      [2, 2], [5, 5],
      [2, 5], [5, 2],
      [3, 3], [4, 4],
      [3, 4], [4, 3],
      [4, 0], [3, 7],
    ],
  },
  9: {
    [DIFFICULTY_LEVELS.EASY]: [
      [3, 2], [5, 6],
      [3, 6], [5, 2],
      [4, 4], // Center obstacle
    ],
    [DIFFICULTY_LEVELS.MEDIUM]: [
      [3, 2], [5, 6],
      [3, 6], [5, 2],
      [4, 1], [4, 7],
      [4, 4],
    ],
    [DIFFICULTY_LEVELS.HARD]: [
      [2, 2], [6, 6],
      [2, 6], [6, 2],
      [3, 4], [5, 4],
      [4, 2], [4, 6],
      [4, 4],
    ],
  },
};

/**
 * Pre-defined power-up potion configurations by difficulty
 */
const ITEM_PRESETS = {
  8: {
    [DIFFICULTY_LEVELS.EASY]: [
      { type: ITEM_TYPES.POTION_SPEED, positions: [[2, 1], [5, 6], [2, 6], [5, 1]] },
      { type: ITEM_TYPES.POTION_INFECTION, positions: [[2, 3], [5, 4], [2, 4], [5, 3]] },
      { type: ITEM_TYPES.POTION_CLONE, positions: [[1, 3], [6, 4]] },
    ],
    [DIFFICULTY_LEVELS.MEDIUM]: [
      { type: ITEM_TYPES.POTION_SPEED, positions: [[2, 0], [5, 7]] },
      { type: ITEM_TYPES.POTION_INFECTION, positions: [[2, 4], [5, 3]] },
      { type: ITEM_TYPES.POTION_CLONE, positions: [[2, 7], [5, 0]] },
    ],
    [DIFFICULTY_LEVELS.HARD]: [
      { type: ITEM_TYPES.POTION_SPEED, positions: [[1, 1], [6, 6]] },
      { type: ITEM_TYPES.POTION_INFECTION, positions: [[3, 1], [4, 6]] },
      { type: ITEM_TYPES.POTION_CLONE, positions: [[3, 6], [4, 1]] },
    ],
  },
  9: {
    [DIFFICULTY_LEVELS.EASY]: [
      { type: ITEM_TYPES.POTION_SPEED, positions: [[2, 1], [6, 7], [2, 7], [6, 1]] },
      { type: ITEM_TYPES.POTION_INFECTION, positions: [[2, 3], [6, 5], [2, 5], [6, 3]] },
      { type: ITEM_TYPES.POTION_CLONE, positions: [[1, 4], [7, 4]] },
    ],
    [DIFFICULTY_LEVELS.MEDIUM]: [
      { type: ITEM_TYPES.POTION_SPEED, positions: [[2, 0], [6, 8]] },
      { type: ITEM_TYPES.POTION_INFECTION, positions: [[3, 3], [5, 5]] },
      { type: ITEM_TYPES.POTION_CLONE, positions: [[2, 8], [6, 0]] },
    ],
    [DIFFICULTY_LEVELS.HARD]: [
      { type: ITEM_TYPES.POTION_SPEED, positions: [[1, 2], [7, 6]] },
      { type: ITEM_TYPES.POTION_INFECTION, positions: [[3, 1], [5, 7]] },
      { type: ITEM_TYPES.POTION_CLONE, positions: [[3, 7], [5, 1]] },
    ],
  },
};

/**
 * Check connectivity between Player 1 row and Player 2 row using BFS
 */
function isBoardTraversable(size, obstaclesSet) {
  const visited = new Set();
  const queue = [];

  // Start BFS from all open cells in Row 0
  for (let c = 0; c < size; c++) {
    if (!obstaclesSet.has(`0,${c}`)) {
      queue.push([0, c]);
      visited.add(`0,${c}`);
    }
  }

  const targetRow = size - 1;
  const directions = [
    [-1, 0], [1, 0], [0, -1], [0, 1]
  ];

  while (queue.length > 0) {
    const [r, c] = queue.shift();
    if (r === targetRow) {
      return true; // Reached opponent back row successfully
    }

    for (const [dr, dc] of directions) {
      const nr = r + dr;
      const nc = c + dc;
      const key = `${nr},${nc}`;

      if (nr >= 0 && nr < size && nc >= 0 && nc < size && !visited.has(key) && !obstaclesSet.has(key)) {
        visited.add(key);
        queue.push([nr, nc]);
      }
    }
  }

  return false;
}

/**
 * Procedurally generate random symmetrical obstacles and potions
 */
function generateRandomMapLayout(size) {
  const obstacles = [];
  const obstaclesSet = new Set();
  const items = [];
  const occupied = new Set();

  // Reserve spawn rows (Row 0 and Row size-1)
  for (let c = 0; c < size; c++) {
    occupied.add(`0,${c}`);
    occupied.add(`${size - 1},${c}`);
  }

  // Generate 2 to 4 pairs of symmetrical obstacles (4 to 8 total)
  const obstaclePairCount = size === 8 ? 3 : 4;
  let attempts = 0;

  while (obstacles.length < obstaclePairCount * 2 && attempts < 100) {
    attempts++;
    // Choose row between row 2 and size - 3
    const r = Math.floor(Math.random() * (size - 4)) + 2;
    const c = Math.floor(Math.random() * size);
    const [symR, symC] = getSymmetricalPair(r, c, size);

    const key1 = `${r},${c}`;
    const key2 = `${symR},${symC}`;

    if (!occupied.has(key1) && !occupied.has(key2)) {
      // Test traversability with only obstacles
      const tempObstacles = new Set(obstaclesSet);
      tempObstacles.add(key1);
      tempObstacles.add(key2);

      if (isBoardTraversable(size, tempObstacles)) {
        occupied.add(key1);
        occupied.add(key2);
        obstaclesSet.add(key1);
        obstaclesSet.add(key2);
        obstacles.push([r, c]);
        if (key1 !== key2) {
          obstacles.push([symR, symC]);
        }
      }
    }
  }

  // Generate 1 pair for each power-up item (Speed, Infection, Clone)
  const potionTypes = [
    ITEM_TYPES.POTION_SPEED,
    ITEM_TYPES.POTION_INFECTION,
    ITEM_TYPES.POTION_CLONE,
  ];

  for (const potionType of potionTypes) {
    let placed = false;
    let potionAttempts = 0;

    while (!placed && potionAttempts < 50) {
      potionAttempts++;
      const r = Math.floor(Math.random() * (size - 2)) + 1;
      const c = Math.floor(Math.random() * size);
      const [symR, symC] = getSymmetricalPair(r, c, size);

      const key1 = `${r},${c}`;
      const key2 = `${symR},${symC}`;

      if (!occupied.has(key1) && !occupied.has(key2) && key1 !== key2) {
        occupied.add(key1);
        occupied.add(key2);
        items.push({ type: potionType, row: r, col: c });
        items.push({ type: potionType, row: symR, col: symC });
        placed = true;
      }
    }
  }

  return { obstacles, items };
}

/**
 * Generate complete map layout descriptor
 * @param {Object} options
 * @param {number} [options.size=8] - 8 for 8x8 or 9 for 9x9
 * @param {string} [options.difficulty='medium'] - 'easy'|'medium'|'hard'|'random'
 * @returns {Object} Full map configuration
 */
function generateMap({ size = 8, difficulty = DIFFICULTY_LEVELS.MEDIUM } = {}) {
  const validSize = size === 9 ? 9 : 8;
  const normalizedDifficulty = (difficulty || DIFFICULTY_LEVELS.MEDIUM).toLowerCase();

  let obstacles = [];
  let items = [];

  if (normalizedDifficulty === DIFFICULTY_LEVELS.RANDOM) {
    const randomLayout = generateRandomMapLayout(validSize);
    obstacles = randomLayout.obstacles;
    items = randomLayout.items;
  } else {
    // Lookup presets
    const diffKey = OBSTACLE_PRESETS[validSize][normalizedDifficulty]
      ? normalizedDifficulty
      : DIFFICULTY_LEVELS.MEDIUM;

    obstacles = [...OBSTACLE_PRESETS[validSize][diffKey]];

    const itemPreset = ITEM_PRESETS[validSize][diffKey] || [];
    for (const group of itemPreset) {
      for (const [r, c] of group.positions) {
        items.push({ type: group.type, row: r, col: c });
      }
    }
  }

  // Construct initial piece spawn assignments
  const spawnTypes = getInitialSpawnTypes(validSize);
  const player1Spawns = spawnTypes.map((type, col) => ({
    player: 1,
    type,
    row: 0,
    col,
  }));

  // Player 2 spawns: symmetrical inversion
  const player2Spawns = spawnTypes.map((type, col) => {
    const mirrorCol = validSize - 1 - col;
    return {
      player: 2,
      type,
      row: validSize - 1,
      col: mirrorCol,
    };
  });

  return {
    name: `Tactical Arena ${validSize}x${validSize} (${normalizedDifficulty.toUpperCase()})`,
    size: validSize,
    rows: validSize,
    cols: validSize,
    difficulty: normalizedDifficulty,
    obstacles,
    items,
    spawns: {
      player1: player1Spawns,
      player2: player2Spawns,
    },
  };
}

/**
 * Build initial 2D board matrix from map configuration
 * @param {Object} mapConfig
 * @returns {Array<Array<{ piece: GamePiece|null, item: string|null }>>}
 */
function createBoardMatrix(mapConfig) {
  const { rows, cols, obstacles, items, spawns } = mapConfig;

  // Initialize empty grid
  const grid = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      piece: null,
      item: null,
    }))
  );

  // Place obstacles
  if (Array.isArray(obstacles)) {
    for (const [r, c] of obstacles) {
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        grid[r][c].item = ITEM_TYPES.OBSTACLE;
      }
    }
  }

  // Place power-up items
  if (Array.isArray(items)) {
    for (const item of items) {
      const { type, row, col } = item;
      if (row >= 0 && row < rows && col >= 0 && col < cols && !grid[row][col].item) {
        grid[row][col].item = type;
      }
    }
  }

  // Place player 1 pieces
  if (spawns?.player1) {
    for (const sp of spawns.player1) {
      grid[sp.row][sp.col].piece = new GamePiece({
        id: `p1_${sp.col}`,
        player: 1,
        type: sp.type,
        row: sp.row,
        col: sp.col,
      });
    }
  }

  // Place player 2 pieces
  if (spawns?.player2) {
    for (const sp of spawns.player2) {
      grid[sp.row][sp.col].piece = new GamePiece({
        id: `p2_${sp.col}`,
        player: 2,
        type: sp.type,
        row: sp.row,
        col: sp.col,
      });
    }
  }

  return grid;
}

module.exports = {
  generateMap,
  createBoardMatrix,
  getSymmetricalPair,
  isBoardTraversable,
};
