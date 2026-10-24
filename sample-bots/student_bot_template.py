#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
 BẢN MẪU BOT HỌC SINH THAM GIA ĐẤU TRƯỜNG CỜ KÉO - BÚA - BAO
 File: sample-bots/student_bot_template.py
 Ngôn ngữ: Python 3
 Giao thức:
   - Đọc dữ liệu trạng thái bàn cờ qua STDIN (JSON)
   - Xuất kết quả nước đi được chọn qua STDOUT (JSON)
=============================================================================
"""

import sys
import json

# Ma trận tính điểm tương quan sức mạnh: 1 = Thắng, -1 = Thua, 0 = Hòa
COMBAT_RULES = {
    "ROCK": {"SCISSORS": 1, "PAPER": -1, "ROCK": 0, "F": 10},
    "PAPER": {"ROCK": 1, "SCISSORS": -1, "PAPER": 0, "F": 10},
    "SCISSORS": {"PAPER": 1, "ROCK": -1, "SCISSORS": 0, "F": 10},
    "R": {"S": 1, "P": -1, "R": 0, "F": 10},
    "P": {"R": 1, "S": -1, "P": 0, "F": 10},
    "S": {"P": 1, "R": -1, "S": 0, "F": 10},
}

# Điểm ưu tiên khi nhặt các bình phần thưởng trên bản đồ
POTION_SCORES = {
    "POTION_CLONE": 50,      # Bình Sinh Sản: Tăng thêm 1 quân cờ
    "POTION_INFECTION": 45,  # Bình Đồng Hóa: Biến quân đối phương thành quân mình
    "POTION_SPEED": 30,      # Bình Tăng Tốc: Đi 2 bước trong lượt
}

def evaluate_move(my_piece, from_r, from_c, to_r, to_c, grid, my_player, rows, cols):
    """Tính điểm chiến thuật cho một nước đi tiềm năng."""
    score = 0
    target = grid[to_r][to_c]

    target_piece = target.get("piece") if isinstance(target, dict) else target
    target_item = target.get("item") if isinstance(target, dict) else None

    # 1. Nếu ô đích có bình vật phẩm
    if target_item and target_item in POTION_SCORES:
        score += POTION_SCORES[target_item]

    # 2. Nếu ô đích có quân cờ đối phương
    if target_piece and target_piece.get("player") != my_player:
        my_type = my_piece.get("type")
        enemy_type = target_piece.get("type")
        duel = COMBAT_RULES.get(my_type, {}).get(enemy_type, 0)

        if duel > 0:
            score += 80  # Ăn được quân địch!
            if my_piece.get("hasInfectionBuff"):
                score += 50  # Có Buff Đồng Hóa, thu phục quân địch thành quân ta
        elif duel < 0:
            score -= 100  # Lao vào quân khắc chế ta -> Tự sát, cấm đi!
        else:
            score -= 10   # Đồng quy vu tận

    # 3. Tiến quân về phía phần sân đối phương
    forward_direction = 1 if my_player == 1 else -1
    if (to_r - from_r) * forward_direction > 0:
        score += 5

    # 4. Kiểm tra an toàn: Tránh đi vào ô bị quân địch kề bên khắc chế
    directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    for dr, dc in directions:
        adj_r, adj_c = to_r + dr, to_c + dc
        if 0 <= adj_r < rows and 0 <= adj_c < cols:
            adj_cell = grid[adj_r][adj_c]
            adj_piece = adj_cell.get("piece") if isinstance(adj_cell, dict) else adj_cell
            if adj_piece and adj_piece.get("player") != my_player:
                enemy_type = adj_piece.get("type")
                if COMBAT_RULES.get(enemy_type, {}).get(my_piece.get("type"), 0) > 0:
                    score -= 40  # Ô này nguy hiểm, đối phương có thể ăn ta ở lượt sau

    return score

def main():
    try:
        raw_data = sys.stdin.read().strip()
        if not raw_data:
            return

        game_state = json.loads(raw_data)
        my_player = game_state.get("player_id", 1)
        grid = game_state.get("grid", [])

        rows = len(grid)
        cols = len(grid[0]) if rows > 0 else 0

        best_move = None
        highest_score = -999999

        # Quét tất cả quân của mình trên bàn cờ
        for r in range(rows):
            for c in range(cols):
                cell = grid[r][c]
                piece = cell.get("piece") if isinstance(cell, dict) else cell

                if piece and piece.get("player") == my_player:
                    has_speed = piece.get("hasSpeedBuff", False)

                    # Các hướng di chuyển cơ bản (1 bước)
                    deltas = [(-1, 0), (1, 0), (0, -1), (0, 1)]
                    if has_speed:
                        # Thêm các hướng 2 bước nếu có Buff Tăng Tốc
                        deltas += [(-2, 0), (2, 0), (0, -2), (0, 2), (-1, -1), (-1, 1), (1, -1), (1, 1)]

                    for dr, dc in deltas:
                        nr, nc = r + dr, c + dc
                        if 0 <= nr < rows and 0 <= nc < cols:
                            target = grid[nr][nc]
                            target_piece = target.get("piece") if isinstance(target, dict) else target
                            target_item = target.get("item") if isinstance(target, dict) else None

                            # Không thể đi vào chướng ngại vật hoặc quân cùng đội
                            if target_item == "OBSTACLE":
                                continue
                            if target_piece and target_piece.get("player") == my_player:
                                continue

                            score = evaluate_move(piece, r, c, nr, nc, grid, my_player, rows, cols)
                            if score > highest_score:
                                highest_score = score
                                best_move = {
                                    "fromRow": r,
                                    "fromCol": c,
                                    "toRow": nr,
                                    "toCol": nc,
                                }

        # Xuất kết quả nước đi dạng JSON ra STDOUT
        if best_move:
            print(json.dumps(best_move))
        else:
            print(json.dumps({}))

    except Exception as e:
        # Ghi log lỗi ra stderr nếu cần gỡ lỗi
        sys.stderr.write(f"Error in student bot: {str(e)}\n")
        print(json.dumps({}))

if __name__ == "__main__":
    main()
