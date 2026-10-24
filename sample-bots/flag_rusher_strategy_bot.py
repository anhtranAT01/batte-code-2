#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
 BẢN MẪU BOT SINH VIÊN ĐẠI HỌC - CHIẾN THUẬT CƯỚP CỜ THẦN TỐC (A* / HEURISTIC)
=============================================================================
 Mục tiêu: 
   - Di chuyển quân cờ của mình đến ô căn cứ cờ của đối phương để THẮNG NGAY LẬP TỨC:
     + Nếu là Phe 1 (P1): Đích đến là ô cờ Phe 2 tại (N-1, N-1) [vd: (8,8) trên bàn 9x9].
     + Nếu là Phe 2 (P2): Đích đến là ô cờ Phe 1 tại (0,0).
   - Tận dụng quy tắc Kéo - Búa - Bao khi chạm trán:
     + BÚA (Rock) đập KÉO (Scissors)
     + KÉO (Scissors) cắt BAO (Paper)
     + BAO (Paper) bọc BÚA (Rock)
   - Nhặt bình bảo vật trên đường đi:
     + ⚡ Bình Đi 2 bước (POTION_SPEED): Cho phép phi nước đại 2 ô để cướp cờ chớp nhoáng!
     + 🧪 Bình Đồng hóa (POTION_INFECTION): Khi ăn quân địch, biến quân đó thành quân phe mình!
     + ➕ Bình Nhân bản (POTION_CLONE): Sinh thêm 1 quân hỗ trợ vây cờ!

 Chuẩn I/O:
   - Input (STDIN): 1 chuỗi JSON chứa thông tin bàn cờ, quân cờ, tọa độ cờ đối phương.
   - Output (STDOUT): In ra ĐÚNG 1 dòng JSON: {"fromRow": r1, "fromCol": c1, "toRow": r2, "toCol": c2}
=============================================================================
"""

import sys
import json
import math

# Bảng quy tắc tương khắc Kéo - Búa - Bao
# 1: Thắng, -1: Thua, 0: Hòa
RPS_RULES = {
    'ROCK':     {'SCISSORS': 1, 'PAPER': -1, 'ROCK': 0, 'R': 0, 'S': 1, 'P': -1},
    'PAPER':    {'ROCK': 1, 'SCISSORS': -1, 'PAPER': 0, 'R': 1, 'S': -1, 'P': 0},
    'SCISSORS': {'PAPER': 1, 'ROCK': -1, 'SCISSORS': 0, 'R': -1, 'S': 0, 'P': 1},
    'R':        {'SCISSORS': 1, 'PAPER': -1, 'ROCK': 0, 'R': 0, 'S': 1, 'P': -1},
    'P':        {'ROCK': 1, 'SCISSORS': -1, 'PAPER': 0, 'R': 1, 'S': -1, 'P': 0},
    'S':        {'PAPER': 1, 'ROCK': -1, 'SCISSORS': 0, 'R': -1, 'S': 0, 'P': 1},
}

def normalize_type(ptype):
    """Chuẩn hóa ký hiệu quân cờ về dạng ROCK, PAPER, SCISSORS"""
    if not ptype:
        return 'ROCK'
    t = str(ptype).upper()
    if t in ('R', 'ROCK'): return 'ROCK'
    if t in ('P', 'PAPER'): return 'PAPER'
    if t in ('S', 'SCISSORS'): return 'SCISSORS'
    return t

def evaluate_rps(attacker_type, defender_type):
    """Trả về 1 (Thắng), -1 (Thua), 0 (Hòa)"""
    a = normalize_type(attacker_type)
    d = normalize_type(defender_type)
    return RPS_RULES.get(a, {}).get(d, 0)

def manhattan_distance(r1, c1, r2, c2):
    """Tính khoảng cách Manhattan giữa 2 tọa độ"""
    return abs(r1 - r2) + abs(c1 - c2)

class FlagRusherBot:
    def __init__(self, state):
        self.state = state
        self.my_player = state.get('player_id', 1)
        self.enemy_player = 2 if self.my_player == 1 else 1
        self.grid = state.get('grid', [])
        self.board_size = state.get('board_size', len(self.grid) if self.grid else 9)
        self.rows = self.board_size
        self.cols = self.board_size

        # Xác định tọa độ Căn cứ cờ đối phương
        # Phe 1 cần tới (rows-1, cols-1) [vd: (8,8)]
        # Phe 2 cần tới (0, 0)
        target = state.get('target_flag') or state.get('enemy_flag')
        if target:
            self.enemy_flag = (target[0], target[1])
        else:
            self.enemy_flag = (self.rows - 1, self.cols - 1) if self.my_player == 1 else (0, 0)

    def is_inside(self, r, c):
        return 0 <= r < self.rows and 0 <= c < self.cols

    def get_legal_moves_for_piece(self, r, c, piece):
        """Liệt kê toàn bộ các nước đi hợp lệ cho quân cờ tại (r, c)"""
        moves = []
        has_speed = piece.get('hasSpeedBuff', False)

        # 4 hướng di chuyển cơ bản (Lên, Xuống, Trái, Phải)
        deltas = [(-1, 0), (1, 0), (0, -1), (0, 1)]

        # Nếu có buff Đi 2 bước (⚡ POTION_SPEED), bổ sung đi 2 ô hoặc đi chéo
        if has_speed:
            deltas += [
                (-2, 0), (2, 0), (0, -2), (0, 2),
                (-1, -1), (-1, 1), (1, -1), (1, 1)
            ]

        for dr, dc in deltas:
            nr, nc = r + dr, c + dc
            if not self.is_inside(nr, nc):
                continue

            target_cell = self.grid[nr][nc] if self.is_inside(nr, nc) else None
            if not target_cell:
                continue

            item = target_cell.get('item')
            # Không thể đi vào ô chướng ngại vật (🧱 OBSTACLE)
            if item == 'OBSTACLE':
                continue

            target_piece = target_cell.get('piece')
            # Không thể dẫm lên quân cờ cùng phe mình
            if target_piece and target_piece.get('player') == self.my_player:
                continue

            moves.append({
                'fromRow': r,
                'fromCol': c,
                'toRow': nr,
                'toCol': nc,
                'piece': piece,
                'target_piece': target_piece,
                'item': item
            })

        return moves

    def evaluate_move(self, move):
        """
        Đánh giá điểm số Heuristic cho một nước đi:
        Điểm càng cao -> Nước đi càng mang tính chiến lược quyết định!
        """
        score = 0.0
        to_r = move['toRow']
        to_c = move['toCol']
        from_r = move['fromRow']
        from_c = move['fromCol']
        piece = move['piece']
        target_piece = move['target_piece']
        item = move['item']

        # 1. CƯỚP CỜ THẮNG TRẬN (ƯU TIÊN TUYỆT ĐỐI)
        # Nếu nước đi này tiến thẳng vào căn cứ cờ đối phương -> THẮNG NGAY LẬP TỨC!
        if (to_r, to_c) == self.enemy_flag:
            if not target_piece:
                return 100000.0  # Ô cờ trống -> Cướp cờ thắng ngay!
            else:
                # Nếu có quân địch trấn thủ căn cứ cờ
                combat = evaluate_rps(piece.get('type'), target_piece.get('type'))
                if combat > 0:
                    return 99999.0  # Ta ăn quân thủ cờ -> Cướp cờ thắng luôn!
                elif combat == 0:
                    score += 500.0
                else:
                    score -= 5000.0 # Thua quân thủ cờ, không nên tự sát

        # 2. RÚT NGẮN KHOẢNG CÁCH TỚI CỜ ĐỐI PHƯƠNG
        old_dist = manhattan_distance(from_r, from_c, self.enemy_flag[0], self.enemy_flag[1])
        new_dist = manhattan_distance(to_r, to_c, self.enemy_flag[0], self.enemy_flag[1])
        dist_diff = old_dist - new_dist  # Dương nếu tiến gần cờ hơn
        score += dist_diff * 45.0

        # Càng gần cờ đối phương thì càng được cộng điểm đột phá
        score += (self.rows * 2 - new_dist) * 10.0

        # 3. GIAO TRANH QUÂN ĐỐI PHƯƠNG (LUẬT KÉO - BÚA - BAO)
        if target_piece and target_piece.get('player') == self.enemy_player:
            combat = evaluate_rps(piece.get('type'), target_piece.get('type'))
            if combat > 0:
                # Quân ta ăn quân địch
                score += 350.0
                # Nếu ta có Buff Đồng Hóa (🧪), ăn xong biến địch thành đồng minh -> CỰC MẠNH!
                if piece.get('hasInfectionBuff'):
                    score += 200.0
            elif combat == 0:
                # Hòa cờ (cả 2 cùng biến mất)
                score -= 40.0
            else:
                # Quân ta bị quân địch ăn (Tự sát) -> Phạt điểm nặng!
                score -= 800.0

        # 4. ĂN BÌNH BẢO VẬT (POWER-UP POTIONS)
        if item == 'POTION_SPEED':
            # Bình Tăng Tốc 2 bước -> Cực kỳ hữu dụng để bứt tốc cướp cờ!
            score += 180.0
        elif item == 'POTION_CLONE':
            # Bình Nhân Bản thêm 1 quân -> Tăng áp lực quân số
            score += 160.0
        elif item == 'POTION_INFECTION':
            # Bình Đồng Hóa
            score += 130.0

        # 5. NÉ TRÁNH NGUY HIỂM TỪ QUÂN ĐỊCH XUNG QUANH
        # Kiểm tra xem ô đến (to_r, to_c) có bị quân địch liền kề khắc chế không
        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            adj_r, adj_c = to_r + dr, to_c + dc
            if self.is_inside(adj_r, adj_c):
                adj_cell = self.grid[adj_r][adj_c]
                adj_piece = adj_cell.get('piece')
                if adj_piece and adj_piece.get('player') == self.enemy_player:
                    threat = evaluate_rps(adj_piece.get('type'), piece.get('type'))
                    if threat > 0:
                        # Ô này đứng cạnh quân địch có thể ăn ta ở lượt sau
                        score -= 90.0

        return score

    def choose_best_move(self):
        """Quét tất cả quân cờ phe mình và chọn nước đi có điểm Heuristic cao nhất"""
        all_legal_moves = []

        for r in range(self.rows):
            for c in range(self.cols):
                cell = self.grid[r][c]
                piece = cell.get('piece')
                if piece and piece.get('player') == self.my_player:
                    moves = self.get_legal_moves_for_piece(r, c, piece)
                    all_legal_moves.extend(moves)

        if not all_legal_moves:
            return None

        # Sắp xếp và chọn nước đi có điểm số cao nhất
        best_move = max(all_legal_moves, key=self.evaluate_move)
        return {
            'fromRow': best_move['fromRow'],
            'fromCol': best_move['fromCol'],
            'toRow': best_move['toRow'],
            'toCol': best_move['toCol'],
        }

def main():
    try:
        raw_input_data = sys.stdin.read().strip()
        if not raw_input_data:
            # Dữ liệu fallback nếu chạy test trực tiếp không có input
            print(json.dumps({"fromRow": 0, "fromCol": 0, "toRow": 1, "toCol": 0}))
            return

        game_state = json.loads(raw_input_data)
        bot = FlagRusherBot(game_state)
        move = bot.choose_best_move()

        if move:
            print(json.dumps(move))
        else:
            # Fallback nếu không còn nước đi
            print(json.dumps({"fromRow": 0, "fromCol": 0, "toRow": 0, "toCol": 0}))
    except Exception as e:
        # In nước đi mặc định nếu xảy ra lỗi bất ngờ để tránh timeout
        sys.stderr.write(f"Error in Bot execution: {str(e)}\n")
        print(json.dumps({"fromRow": 0, "fromCol": 0, "toRow": 1, "toCol": 0}))

if __name__ == '__main__':
    main()
