#!/usr/bin/env python3
"""
Random Walker Bot for Tactical Rock-Paper-Scissors Arena
Language: Python 3
Protocol: Read game state JSON from STDIN, output chosen move JSON to STDOUT.
"""
import sys
import json
import random

def solve():
    raw_input = sys.stdin.read().strip()
    if not raw_input:
        return

    data = json.loads(raw_input)
    player = data.get("player_id", 1)
    grid = data.get("grid", [])
    rows = len(grid)
    cols = len(grid[0]) if rows > 0 else 0

    valid_moves = []
    directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]

    for r in range(rows):
        for c in range(cols):
            piece = grid[r][c]
            if piece and piece.get("player") == player and piece.get("type") != "F":
                for dr, dc in directions:
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < rows and 0 <= nc < cols:
                        target = grid[nr][nc]
                        if not target or (target.get("player") != player and target.get("type") != "OBSTACLE"):
                            valid_moves.append({
                                "fromRow": r,
                                "fromCol": c,
                                "toRow": nr,
                                "toCol": nc
                            })

    if valid_moves:
        chosen = random.choice(valid_moves)
        print(json.dumps(chosen))
    else:
        # No legal move
        print(json.dumps({}))

if __name__ == "__main__":
    solve()
