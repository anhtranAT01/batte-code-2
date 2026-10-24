#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
 BATTLECODE 9x9 - THUẬT TOÁN TÌM ĐƯỜNG A* CƯỚP CỜ / CHIẾM CỨ ĐIỂM (PYTHON BOT)
 File: sample-bots/astar_flag_rusher_bot.py
 Mô tả:
   Thuật toán tìm kiếm theo đồ thị A* (A-Star Pathfinding Algorithm) với hàm
   đánh giá Heuristic f(n) = g(n) + h(n) chuyên dụng cho chiến thuật:
   1. Lao thẳng về hàng cuối của đối thủ để cướp cờ (Flag / Base Rush).
   2. Tự động tính toán đường tránh (avoidance path) các quân khắc chế của đối thủ.
   3. Chủ động ghé qua nhặt bình Đồng Hóa và bình Tăng Tốc trên lộ trình ngắn nhất.
   
 Giao thức:
   - Đọc trạng thái bàn cờ qua STDIN (JSON)
   - Xuất kết quả nước đi tối ưu qua STDOUT (JSON): {"fromRow": r1, "fromCol": c1, "toRow": r2, "toCol": c2}
=============================================================================
"""

import sys
import json
import heapq

# Bảng tương khắc Oẳn Tù Tì
COMBAT_ADVANTAGE = {
    "ROCK": {"SCISSORS": 1, "PAPER": -1, "ROCK": 0, "R": 0, "S": 1, "P": -1},
    "PAPER": {"ROCK": 1, "SCISSORS": -1, "PAPER": 0, "R": 1, "P": 0, "S": -1},
    "SCISSORS": {"PAPER": 1, "ROCK": -1, "SCISSORS": 0, "R": -1, "P": 1, "S": 0},
    "R": {"S": 1, "P": -1, "R": 0, "SCISSORS": 1, "PAPER": -1, "ROCK": 0},
    "P": {"R": 1, "S": -1, "P": 0, "ROCK": 1, "SCISSORS": -1, "PAPER": 0},
    "S": {"P": 1, "R": -1, "S": 0, "PAPER": 1, "ROCK": -1, "SCISSORS": 0},
}

def get_piece(cell):
    if not cell:
        return None
    return cell.get("piece") if isinstance(cell, dict) else cell

def get_item(cell):
    return cell.get("item") if isinstance(cell, dict) else None

def manhattan_distance(r1, c1, r2, c2):
    """Tính khoảng cách Manhattan giữa 2 tọa độ."""
    return abs(r1 - r2) + abs(c1 - c2)

def calculate_cell_cost(r, c, piece, grid, my_player, rows, cols):
    """
    Tính chi phí bước chân g(n) khi bước vào ô (r, c):
    - Ô trống: Chi phí cơ bản = 1
    - Bình Buff: Chi phí âm (ưu đãi đi qua để nhặt buff)
    - Quân địch bị ta khắc chế: Chi phí thấp (khuyến khích ăn)
    - Quân địch khắc chế ta: Chi phí cực cao hoặc vô cực (tránh xa)
    - Chướng ngại vật: Vô cực (không thể đi qua)
    """
    cell = grid[r][c]
    item = get_item(cell)
    target_p = get_piece(cell)

    if item == "OBSTACLE":
        return 999999

    cost = 10 # Chi phí đi lại cơ bản

    # Nếu có bình phần thưởng
    if item == "POTION_INFECTION":
        cost -= 8 # Rất nên ghé nhặt
    elif item == "POTION_CLONE":
        cost -= 7
    elif item == "POTION_SPEED":
        cost -= 5

    # Nếu có quân cờ
    if target_p:
        if target_p.get("player") == my_player:
            return 999999 # Không thể giẫm lên quân đồng đội
        else:
            # Quân địch
            my_type = piece.get("type")
            enemy_type = target_p.get("type")
            duel = COMBAT_ADVANTAGE.get(my_type, {}).get(enemy_type, 0)
            if duel > 0:
                cost -= 6 # Ăn được quân địch!
            elif duel < 0:
                cost += 500 # Quân địch khắc chế ta -> Cực kỳ nguy hiểm!
            else:
                cost += 50 # Hòa

    # Kiểm tra ô liền kề xem có nguy cơ bị địch phục kích lượt sau không
    for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
        nr, nc = r + dr, c + dc
        if 0 <= nr < rows and 0 <= nc < cols:
            adj_p = get_piece(grid[nr][nc])
            if adj_p and adj_p.get("player") != my_player:
                enemy_type = adj_p.get("type")
                if COMBAT_ADVANTAGE.get(enemy_type, {}).get(piece.get("type"), 0) > 0:
                    cost += 80 # Địch kề bên có thể bắt bài

    return max(1, cost)

def astar_find_path(start_r, start_c, goal_row, piece, grid, my_player, rows, cols):
    """
    Thuật toán A* tìm đường đi từ ô xuất phát tới hàng đích (cờ địch).
    Trả về: (tổng chi phí f, nước đi đầu tiên)
    """
    # Priority Queue chứa phần tử: (f_score, g_score, curr_r, curr_c, first_step)
    open_set = []
    
    # Heuristic ban đầu h(start)
    h_start = abs(goal_row - start_r) * 10
    heapq.heappush(open_set, (h_start, 0, start_r, start_c, None))

    g_scores = {(start_r, start_c): 0}
    visited = set()

    has_speed = piece.get("hasSpeedBuff", False)
    directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    if has_speed:
        directions += [(-2, 0), (2, 0), (0, -2), (0, 2), (-1, -1), (-1, 1), (1, -1), (1, 1)]

    best_first_step = None
    min_dist_to_goal = abs(goal_row - start_r)

    while open_set:
        f, g, curr_r, curr_c, first_step = heapq.heappop(open_set)

        if (curr_r, curr_c) in visited:
            continue
        visited.add((curr_r, curr_c))

        # Nếu đã chạm tới hàng đích (cướp cờ thành công)
        if curr_r == goal_row:
            return f, first_step

        for dr, dc in directions:
            nr, nc = curr_r + dr, curr_c + dc
            if 0 <= nr < rows and 0 <= nc < cols:
                step_cost = calculate_cell_cost(nr, nc, piece, grid, my_player, rows, cols)
                if step_cost >= 999999:
                    continue

                tentative_g = g + step_cost
                if tentative_g < g_scores.get((nr, nc), float('inf')):
                    g_scores[(nr, nc)] = tentative_g
                    h = abs(goal_row - nr) * 10
                    f_new = tentative_g + h

                    next_first_step = first_step if first_step is not None else (nr, nc)

                    heapq.heappush(open_set, (f_new, tentative_g, nr, nc, next_first_step))

    # Nếu không tới được hàng đích hoàn toàn, chọn đường giảm khoảng cách tới đích nhất
    return float('inf'), None

def main():
    try:
        raw_data = sys.stdin.read().strip()
        if not raw_data:
            print(json.dumps({}))
            return

        game_state = json.loads(raw_data)
        my_player = game_state.get("player_id", 1)
        grid = game_state.get("grid", [])

        rows = len(grid)
        cols = len(grid[0]) if rows > 0 else 0
        if rows == 0 or cols == 0:
            print(json.dumps({}))
            return

        # Hàng đích (cờ / căn cứ của đối phương)
        goal_row = (rows - 1) if my_player == 1 else 0

        best_move = None
        lowest_f_score = float('inf')

        # Quét tất cả quân của mình trên bàn cờ
        for r in range(rows):
            for c in range(cols):
                piece = get_piece(grid[r][c])
                if piece and piece.get("player") == my_player:
                    f_cost, first_step = astar_find_path(r, c, goal_row, piece, grid, my_player, rows, cols)

                    if first_step and f_cost < lowest_f_score:
                        lowest_f_score = f_cost
                        best_move = {
                            "fromRow": r,
                            "fromCol": c,
                            "toRow": first_step[0],
                            "toCol": first_step[1],
                        }

        # Nếu tìm được đường đi tốt nhất bằng A*
        if best_move:
            print(json.dumps(best_move))
        else:
            # Fallback đơn giản nếu đường tới cờ bị chặn kín hoàn toàn
            directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
            for r in range(rows):
                for c in range(cols):
                    piece = get_piece(grid[r][c])
                    if piece and piece.get("player") == my_player:
                        for dr, dc in directions:
                            nr, nc = r + dr, c + dc
                            if 0 <= nr < rows and 0 <= nc < cols:
                                cell = grid[nr][nc]
                                if get_item(cell) != "OBSTACLE" and (not get_piece(cell) or get_piece(cell).get("player") != my_player):
                                    print(json.dumps({"fromRow": r, "fromCol": c, "toRow": nr, "toCol": nc}))
                                    return
            print(json.dumps({}))

    except Exception as e:
        sys.stderr.write(f"A* Flag Rusher Bot Error: {str(e)}\n")
        print(json.dumps({}))

if __name__ == "__main__":
    main()
