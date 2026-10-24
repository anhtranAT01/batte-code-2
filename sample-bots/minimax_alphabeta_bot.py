#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
 BATTLECODE 9x9 - THUẬT TOÁN MINIMAX VỚI TỈA NHÁNH ALPHA-BETA (PYTHON BOT)
 File: sample-bots/minimax_alphabeta_bot.py
 Mô tả:
   Thuật toán tìm kiếm theo chiều sâu (Depth-Limited Minimax) kết hợp kĩ thuật
   tỉa nhánh Alpha-Beta (Alpha-Beta Pruning) giúp bot dự đoán trước 2-3 nước đi
   của đối thủ, tối ưu hóa điểm số bàn cờ (Material + Positional + Items).
   
 Giao thức:
   - Đọc trạng thái bàn cờ qua STDIN (JSON)
   - Xuất kết quả nước đi tối ưu qua STDOUT (JSON): {"fromRow": r1, "fromCol": c1, "toRow": r2, "toCol": c2}
=============================================================================
"""

import sys
import json
import time

# Quy tắc tương khắc Oẳn Tù Tì: 1 = Thắng, -1 = Thua, 0 = Hòa
COMBAT_MATRIX = {
    "ROCK": {"SCISSORS": 1, "PAPER": -1, "ROCK": 0, "R": 0, "S": 1, "P": -1},
    "PAPER": {"ROCK": 1, "SCISSORS": -1, "PAPER": 0, "R": 1, "P": 0, "S": -1},
    "SCISSORS": {"PAPER": 1, "ROCK": -1, "SCISSORS": 0, "R": -1, "P": 1, "S": 0},
    "R": {"S": 1, "P": -1, "R": 0, "SCISSORS": 1, "PAPER": -1, "ROCK": 0},
    "P": {"R": 1, "S": -1, "P": 0, "ROCK": 1, "SCISSORS": -1, "PAPER": 0},
    "S": {"P": 1, "R": -1, "S": 0, "PAPER": 1, "ROCK": -1, "SCISSORS": 0},
}

# Điểm thưởng vật phẩm trên bàn cờ
ITEM_WEIGHTS = {
    "POTION_INFECTION": 50,  # Bình Đồng Hóa: Biến quân đối phương thành quân mình
    "POTION_CLONE": 45,      # Bình Sinh Sản: Tăng thêm quân số
    "POTION_SPEED": 30,      # Bình Tăng Tốc: Cơ động cao
}

def get_piece_info(cell):
    """Trích xuất thông tin quân cờ từ cell dict."""
    if not cell:
        return None
    if isinstance(cell, dict):
        return cell.get("piece")
    return cell

def get_item_info(cell):
    """Trích xuất vật phẩm/chướng ngại vật từ cell dict."""
    if isinstance(cell, dict):
        return cell.get("item")
    return None

def get_valid_moves(grid, player, rows, cols):
    """Lấy danh sách tất cả các nước đi hợp lệ cho người chơi 'player'."""
    moves = []
    directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]

    for r in range(rows):
        for c in range(cols):
            piece = get_piece_info(grid[r][c])
            if piece and piece.get("player") == player:
                # Kiểm tra buff tăng tốc
                has_speed = piece.get("hasSpeedBuff", False)
                active_dirs = list(directions)
                if has_speed:
                    active_dirs += [(-2, 0), (2, 0), (0, -2), (0, 2), (-1, -1), (-1, 1), (1, -1), (1, 1)]

                for dr, dc in active_dirs:
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < rows and 0 <= nc < cols:
                        target_cell = grid[nr][nc]
                        target_item = get_item_info(target_cell)
                        target_piece = get_piece_info(target_cell)

                        # Không đi vào chướng ngại vật
                        if target_item == "OBSTACLE":
                            continue
                        # Không đi vào quân đồng đội
                        if target_piece and target_piece.get("player") == player:
                            continue

                        moves.append({
                            "fromRow": r,
                            "fromCol": c,
                            "toRow": nr,
                            "toCol": nc,
                            "piece": piece
                        })
    return moves

def evaluate_board(grid, my_player, rows, cols):
    """
    Hàm Heuristic đánh giá trạng thái bàn cờ:
    - Tổng chênh lệch quân số
    - Vị trí áp sát hàng cuối (Cờ / Đích của đối thủ)
    - Kiểm soát các bình phần thưởng
    - Độ an toàn của các quân
    """
    opponent = 2 if my_player == 1 else 1
    score = 0

    my_pieces_count = 0
    opp_pieces_count = 0

    target_enemy_row = (rows - 1) if my_player == 1 else 0

    for r in range(rows):
        for c in range(cols):
            cell = grid[r][c]
            piece = get_piece_info(cell)
            item = get_item_info(cell)

            if piece:
                is_mine = (piece.get("player") == my_player)
                piece_type = piece.get("type")
                
                # Điểm cơ bản cho mỗi quân cờ
                base_value = 100
                if piece.get("hasInfectionBuff"):
                    base_value += 35
                if piece.get("hasSpeedBuff"):
                    base_value += 25

                # Điểm tiến quân về đích (Cướp cờ / chiếm cứ điểm đối thủ)
                dist_to_goal = abs(target_enemy_row - r)
                advancement_bonus = (rows - dist_to_goal) * 8

                if is_mine:
                    my_pieces_count += 1
                    score += (base_value + advancement_bonus)
                else:
                    opp_pieces_count += 1
                    score -= (base_value + (rows - abs(((rows - 1) - target_enemy_row) - r)) * 8)

    # Thắng tuyệt đối nếu tiêu diệt hết quân đối phương
    if opp_pieces_count == 0:
        return 99999
    if my_pieces_count == 0:
        return -99999

    score += (my_pieces_count - opp_pieces_count) * 120
    return score

def simulate_move(grid, move, player, rows, cols):
    """Tạo một bản sao giả lập bàn cờ sau khi thực hiện nước đi."""
    # Tạo deep copy nông gọn nhẹ của ma trận grid
    new_grid = []
    for r in range(rows):
        row_copy = []
        for c in range(cols):
            cell = grid[r][c]
            p = get_piece_info(cell)
            row_copy.append({
                "piece": dict(p) if isinstance(p, dict) else None,
                "item": get_item_info(cell)
            })
        new_grid.append(row_copy)

    fr, fc = move["fromRow"], move["fromCol"]
    tr, tc = move["toRow"], move["toCol"]

    moving_p = new_grid[fr][fc]["piece"]
    target_p = new_grid[tr][tc]["piece"]

    new_grid[fr][fc]["piece"] = None
    new_grid[tr][tc]["item"] = None # Ăn bình vật phẩm nếu có

    if target_p:
        # Xử lý giao tranh
        my_type = moving_p.get("type")
        enemy_type = target_p.get("type")
        duel = COMBAT_MATRIX.get(my_type, {}).get(enemy_type, 0)

        if duel > 0:
            # Thắng
            if moving_p.get("hasInfectionBuff"):
                # Đồng hóa quân địch thành quân mình
                target_p["player"] = player
                target_p["hasInfectionBuff"] = False
                new_grid[tr][tc]["piece"] = moving_p
            else:
                new_grid[tr][tc]["piece"] = moving_p
        elif duel < 0:
            # Thua: Quân ta bị tiêu diệt
            new_grid[tr][tc]["piece"] = target_p
        else:
            # Hòa: Cả 2 cùng chết
            new_grid[tr][tc]["piece"] = None
    else:
        new_grid[tr][tc]["piece"] = moving_p

    return new_grid

def minimax_alphabeta(grid, depth, alpha, beta, is_maximizing, my_player, rows, cols, start_time, time_limit=0.85):
    """
    Thuật toán Minimax kết hợp Tỉa nhánh Alpha-Beta với giới hạn thời gian thực.
    """
    # Kiểm tra thời gian để tránh bị timeout (quá 1.0 giây)
    if time.time() - start_time > time_limit:
        return evaluate_board(grid, my_player, rows, cols), None

    if depth == 0:
        return evaluate_board(grid, my_player, rows, cols), None

    current_player = my_player if is_maximizing else (2 if my_player == 1 else 1)
    moves = get_valid_moves(grid, current_player, rows, cols)

    if not moves:
        return evaluate_board(grid, my_player, rows, cols), None

    # Sắp xếp nước đi để tăng tốc độ cắt tỉa Alpha-Beta (Move ordering)
    def quick_eval(m):
        tr, tc = m["toRow"], m["toCol"]
        target_p = get_piece_info(grid[tr][tc])
        if target_p:
            return 100
        if get_item_info(grid[tr][tc]):
            return 50
        return 0

    moves.sort(key=quick_eval, reverse=True)

    best_move = moves[0]

    if is_maximizing:
        max_eval = -float('inf')
        for move in moves:
            simulated = simulate_move(grid, move, current_player, rows, cols)
            eval_score, _ = minimax_alphabeta(simulated, depth - 1, alpha, beta, False, my_player, rows, cols, start_time, time_limit)
            if eval_score > max_eval:
                max_eval = eval_score
                best_move = move
            alpha = max(alpha, eval_score)
            if beta <= alpha:
                break # Tỉa nhánh Beta
        return max_eval, best_move
    else:
        min_eval = float('inf')
        for move in moves:
            simulated = simulate_move(grid, move, current_player, rows, cols)
            eval_score, _ = minimax_alphabeta(simulated, depth - 1, alpha, beta, True, my_player, rows, cols, start_time, time_limit)
            if eval_score < min_eval:
                min_eval = eval_score
                best_move = move
            beta = min(beta, eval_score)
            if beta <= alpha:
                break # Tỉa nhánh Alpha
        return min_eval, best_move

def main():
    start_time = time.time()
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

        # Độ sâu tìm kiếm Minimax: 2 lượt (đủ sâu để tính nước phản đòn của đối thủ và kịp thời gian 1s)
        search_depth = 2
        _, best_move = minimax_alphabeta(
            grid=grid,
            depth=search_depth,
            alpha=-float('inf'),
            beta=float('inf'),
            is_maximizing=True,
            my_player=my_player,
            rows=rows,
            cols=cols,
            start_time=start_time,
            time_limit=0.85
        )

        if best_move:
            result = {
                "fromRow": best_move["fromRow"],
                "fromCol": best_move["fromCol"],
                "toRow": best_move["toRow"],
                "toCol": best_move["toCol"],
            }
            print(json.dumps(result))
        else:
            # Fallback nếu không tìm thấy nước
            fallback_moves = get_valid_moves(grid, my_player, rows, cols)
            if fallback_moves:
                fm = fallback_moves[0]
                print(json.dumps({"fromRow": fm["fromRow"], "fromCol": fm["fromCol"], "toRow": fm["toRow"], "toCol": fm["toCol"]}))
            else:
                print(json.dumps({}))

    except Exception as e:
        sys.stderr.write(f"Minimax Alpha-Beta Bot Error: {str(e)}\n")
        print(json.dumps({}))

if __name__ == "__main__":
    main()
