#!/usr/bin/env node
/**
 * Tactical Bot for Rock-Paper-Scissors Arena
 * Evaluates tactical piece advantage (Rock > Scissors > Paper > Rock)
 * and prioritizes attacking opponent Flag or weak pieces.
 */
const fs = require('fs');

const BATTLE_ADVANTAGE = {
  R: { S: 10, P: -10, R: 0, F: 100 },
  P: { R: 10, S: -10, P: 0, F: 100 },
  S: { P: 10, R: -10, S: 0, F: 100 },
};

function main() {
  const input = fs.readFileSync(0, 'utf-8').trim();
  if (!input) return;

  const data = JSON.parse(input);
  const myPlayer = data.player_id || 1;
  const grid = data.grid || [];
  const rows = grid.length;
  const cols = rows > 0 ? grid[0].length : 0;

  const candidateMoves = [];
  const directions = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const piece = grid[r][c];
      if (piece && piece.player === myPlayer && piece.type !== 'F') {
        for (const [dr, dc] of directions) {
          const nr = r + dr;
          const nc = c + dc;

          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            const target = grid[nr][nc];

            // Obstacle or own piece cannot be attacked
            if (target && (target.player === myPlayer || target.type === 'OBSTACLE')) {
              continue;
            }

            let score = 1; // Default exploration value

            if (target) {
              // Target is an opponent piece
              score += BATTLE_ADVANTAGE[piece.type]?.[target.type] ?? 0;
            }

            // Small incentive to move towards enemy territory
            const enemyBaseRow = myPlayer === 1 ? rows - 1 : 0;
            const distReduction = Math.abs(r - enemyBaseRow) - Math.abs(nr - enemyBaseRow);
            score += distReduction * 0.5;

            candidateMoves.push({
              move: { fromRow: r, fromCol: c, toRow: nr, toCol: nc },
              score,
            });
          }
        }
      }
    }
  }

  // Sort candidate moves descending by tactical score
  candidateMoves.sort((a, b) => b.score - a.score);

  if (candidateMoves.length > 0) {
    process.stdout.write(JSON.stringify(candidateMoves[0].move) + '\n');
  } else {
    process.stdout.write(JSON.stringify({}) + '\n');
  }
}

main();
