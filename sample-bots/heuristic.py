#!/usr/bin/env python3
"""Bot Heuristic tham lam, Python 3, khong can thu vien ngoai.

Doc mot trang thai JSON tu stdin; chi in mot nuoc di JSON ra stdout.
Uu tien cuop co, an quan co loi, nhat binh va tranh quan khac che.
"""
import json
import sys

STEPS = [(-1, 0), (1, 0), (0, -1), (0, 1)]
SPEED = STEPS + [(-2, 0), (2, 0), (0, -2), (0, 2), (-1, -1), (-1, 1), (1, -1), (1, 1)]
BEATS = {"ROCK": "SCISSORS", "SCISSORS": "PAPER", "PAPER": "ROCK"}
ALIASES = {"R": "ROCK", "S": "SCISSORS", "P": "PAPER"}
ITEMS = {"POTION_CLONE": 65, "POTION_INFECTION": 50, "POTION_SPEED": 40}


def kind(piece):
    value = piece.get("type", "ROCK")
    return ALIASES.get(value, value)


def combat(attacker, defender):
    if kind(attacker) == kind(defender):
        return 0
    return 1 if BEATS[kind(attacker)] == kind(defender) else -1


def distance(row, col, target):
    return abs(row - target[0]) + abs(col - target[1])


def choose_move(state):
    grid = state["grid"]
    rows, cols = len(grid), len(grid[0])
    player = state.get("player_id", 1)
    flag = state.get("enemy_flag") or state.get("target_flag") or ([rows - 1, cols - 1] if player == 1 else [0, 0])
    enemies = [(r, c, cell["piece"]) for r, row in enumerate(grid) for c, cell in enumerate(row)
               if cell.get("piece") and cell["piece"]["player"] != player]

    def reachable(r, c, nr, nc, piece):
        dr, dc = nr - r, nc - c
        if (dr, dc) not in (SPEED if piece.get("hasSpeedBuff") else STEPS):
            return False
        if abs(dr) == 2 or abs(dc) == 2:
            if grid[r + dr // 2][c + dc // 2].get("item") == "OBSTACLE":
                return False
        return True

    best, highest = None, -float("inf")
    for r, row in enumerate(grid):
        for c, cell in enumerate(row):
            piece = cell.get("piece")
            if not piece or piece["player"] != player:
                continue
            for dr, dc in SPEED if piece.get("hasSpeedBuff") else STEPS:
                nr, nc = r + dr, c + dc
                if not (0 <= nr < rows and 0 <= nc < cols) or not reachable(r, c, nr, nc, piece):
                    continue
                target = grid[nr][nc]
                defender = target.get("piece")
                if target.get("item") == "OBSTACLE" or (defender and defender["player"] == player):
                    continue
                duel = combat(piece, defender) if defender else 1
                score = 0
                if defender:
                    score += 90 + (45 if piece.get("hasInfectionBuff") else 0) if duel > 0 else (-200 if duel < 0 else -35)
                if [nr, nc] == list(flag) and duel > 0:
                    score += 100000
                score += ITEMS.get(target.get("item"), 0)
                score += 5 * (distance(r, c, flag) - distance(nr, nc, flag))
                # Nearest-piece progress breaks equal opening scores sensibly.
                score += 10 / (1 + distance(nr, nc, flag))
                for er, ec, enemy in enemies:
                    if (er, ec) == (nr, nc):
                        continue
                    if combat(enemy, piece) > 0 and reachable(er, ec, nr, nc, enemy):
                        score -= 75
                if score > highest:
                    highest = score
                    best = {"fromRow": r, "fromCol": c, "toRow": nr, "toCol": nc}
    return best or {}


if __name__ == "__main__":
    print(json.dumps(choose_move(json.load(sys.stdin))))
