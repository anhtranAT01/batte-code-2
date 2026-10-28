// Fixed teaching examples, not a live search or ranked match.
export const ALGORITHMS = [
  {
    "id": "astar",
    "name": "A* — Tìm đường đến cờ",
    "badge": "Đường đi ngắn nhất",
    "difficulty": "Nâng cao",
    "complexity": "O(b^d)",
    "summary": "Chọn đường tới cờ bằng tổng quãng đường đã đi g(n) và khoảng cách ước tính h(n), đồng thời tránh vật cản.",
    "pseudocode": [
      "def a_star_search(start, goal, grid):",
      "    open_set = PriorityQueue()",
      "    open_set.put(start, priority=0)",
      "    came_from = {}",
      "    cost_so_far[start] = 0",
      "    while not open_set.empty():",
      "        current = open_set.get()",
      "        if current == goal: return reconstruct_path(came_from, current)",
      "        for neighbor in get_neighbors(current, grid):",
      "            new_cost = cost_so_far[current] + cost(current, neighbor)",
      "            if neighbor not in cost_so_far or new_cost < cost_so_far[neighbor]:",
      "                cost_so_far[neighbor] = new_cost",
      "                priority = new_cost + chebyshev_distance(neighbor, goal)",
      "                open_set.put(neighbor, priority)",
      "                came_from[neighbor] = current"
    ],
    "steps": [
      {
        "stepIndex": 0,
        "activeLine": 2,
        "title": "Khởi tạo A* Search",
        "desc": "Đặt quân Búa ở (0, 0), cờ đích ở (6, 6). Với di chuyển 8 hướng, h(n) = max(|Δhàng|, |Δcột|). Ban đầu: g = 0, h = 6.",
        "stats": {
          "currentPos": "(0, 0)",
          "gn": 0,
          "hn": 6,
          "fn": 6
        },
        "gridState": {
          "highlight": [
            [0, 0]
          ],
          "path": [
            [0, 0]
          ],
          "visited": [],
          "obstacles": [
            [2, 1],
            [2, 2],
            [3, 2],
            [4, 4]
          ],
          "target": [6, 6]
        }
      },
      {
        "stepIndex": 1,
        "activeLine": 6,
        "title": "Mở rộng các ô lân cận",
        "desc": "Từ (0, 0), xét cả ô chéo (1, 1). Quãng đường đã đi g = 1, khoảng cách ước tính h = 5, nên f = 6.",
        "stats": {
          "currentPos": "(1, 1)",
          "gn": 1,
          "hn": 5,
          "fn": 6
        },
        "gridState": {
          "highlight": [
            [1, 1]
          ],
          "path": [
            [0, 0],
            [1, 1]
          ],
          "visited": [
            [0, 0],
            [0, 1],
            [1, 0]
          ],
          "obstacles": [
            [2, 1],
            [2, 2],
            [3, 2],
            [4, 4]
          ],
          "target": [6, 6]
        }
      },
      {
        "stepIndex": 2,
        "activeLine": 12,
        "title": "Gặp vật cản (Obstacle)",
        "desc": "Ô (2, 2) là vật cản. Bỏ qua ô bị chặn và xét (1, 2): g = 2, h = 5, f = 7. Không đi xuyên tường.",
        "stats": {
          "currentPos": "(1, 2)",
          "gn": 2,
          "hn": 5,
          "fn": 7
        },
        "gridState": {
          "highlight": [
            [1, 2]
          ],
          "path": [
            [0, 0],
            [1, 1],
            [1, 2]
          ],
          "visited": [
            [0, 0],
            [1, 1],
            [0, 1],
            [1, 0]
          ],
          "obstacles": [
            [2, 1],
            [2, 2],
            [3, 2],
            [4, 4]
          ],
          "target": [6, 6]
        }
      },
      {
        "stepIndex": 3,
        "activeLine": 9,
        "title": "Đi vòng qua vật cản",
        "desc": "Đi qua (2, 3), rồi đến (3, 4). Đường màu xanh nối các ô đã chọn; chấm nhỏ đánh dấu những ô đã xét.",
        "stats": {
          "currentPos": "(3, 4)",
          "gn": 4,
          "hn": 3,
          "fn": 7
        },
        "gridState": {
          "highlight": [
            [3, 4]
          ],
          "path": [
            [0, 0],
            [1, 1],
            [1, 2],
            [2, 3],
            [3, 4]
          ],
          "visited": [
            [0, 0],
            [1, 1],
            [1, 2],
            [2, 3],
            [0, 1],
            [1, 0]
          ],
          "obstacles": [
            [2, 1],
            [2, 2],
            [3, 2],
            [4, 4]
          ],
          "target": [6, 6]
        }
      },
      {
        "stepIndex": 4,
        "activeLine": 13,
        "title": "Chỉ còn một lượt tới cờ",
        "desc": "Tiến tới (4, 5), rồi (5, 6). Quân chỉ còn cách cờ một lượt: g = 6, h = 1, f = 7.",
        "stats": {
          "currentPos": "(5, 6)",
          "gn": 6,
          "hn": 1,
          "fn": 7
        },
        "gridState": {
          "highlight": [
            [5, 6]
          ],
          "path": [
            [0, 0],
            [1, 1],
            [1, 2],
            [2, 3],
            [3, 4],
            [4, 5],
            [5, 6]
          ],
          "visited": [
            [0, 0],
            [1, 1],
            [1, 2],
            [2, 3],
            [3, 4],
            [4, 5],
            [0, 1],
            [1, 0]
          ],
          "obstacles": [
            [2, 1],
            [2, 2],
            [3, 2],
            [4, 4]
          ],
          "target": [6, 6]
        }
      },
      {
        "stepIndex": 5,
        "activeLine": 7,
        "title": "Hoàn tất đường đi tới cờ",
        "desc": "Đến cờ tại (6, 6). Ví dụ hoàn tất với 7 lượt di chuyển. Dãy số trên bàn cờ giúp bạn đọc lại thứ tự đường đi.",
        "stats": {
          "currentPos": "(6, 6)",
          "gn": 7,
          "hn": 0,
          "fn": 7
        },
        "gridState": {
          "highlight": [
            [6, 6]
          ],
          "path": [
            [0, 0],
            [1, 1],
            [1, 2],
            [2, 3],
            [3, 4],
            [4, 5],
            [5, 6],
            [6, 6]
          ],
          "visited": [
            [0, 0],
            [1, 1],
            [1, 2],
            [2, 3],
            [3, 4],
            [4, 5],
            [5, 6],
            [0, 1],
            [1, 0]
          ],
          "obstacles": [
            [2, 1],
            [2, 2],
            [3, 2],
            [4, 4]
          ],
          "target": [6, 6]
        }
      }
    ]
  },
  {
    "id": "minimax",
    "name": "Minimax — Chọn nước đi tốt",
    "badge": "Chiến thuật đối kháng",
    "difficulty": "Thi đấu",
    "complexity": "O(b^(d/2))",
    "summary": "Nhìn trước phản ứng của đối thủ, so sánh các nhánh và bỏ qua những lựa chọn không còn tốt hơn.",
    "pseudocode": [
      "def alpha_beta(state, depth, alpha, beta, is_maximizing):",
      "    if depth == 0 or state.is_terminal(): return evaluate(state)",
      "    if is_maximizing:",
      "        max_eval = -INFINITY",
      "        for move in state.get_legal_moves():",
      "            eval = alpha_beta(state.make_move(move), depth - 1, alpha, beta, False)",
      "            max_eval = max(max_eval, eval)",
      "            alpha = max(alpha, eval)",
      "            if beta <= alpha: break  # Tỉa nhánh Beta Cutoff",
      "        return max_eval",
      "    else:",
      "        min_eval = +INFINITY",
      "        for move in state.get_legal_moves():",
      "            eval = alpha_beta(state.make_move(move), depth - 1, alpha, beta, True)",
      "            min_eval = min(min_eval, eval)",
      "            beta = min(beta, eval)",
      "            if beta <= alpha: break  # Tỉa nhánh Alpha Cutoff",
      "        return min_eval"
    ],
    "steps": [
      {
        "stepIndex": 0,
        "activeLine": 1,
        "title": "Khởi tạo Root Node (Lượt của Ta)",
        "desc": "Bắt đầu tại nút gốc (Max Node) với [alpha = -inf, beta = +inf]. Đánh giá các nước đi tiềm năng.",
        "stats": {
          "depth": 3,
          "alpha": "-inf",
          "beta": "+inf",
          "evaluatedNodes": 1,
          "cutoffs": 0
        },
        "gridState": {
          "highlight": [
            [2, 2]
          ],
          "path": [
            [2, 2]
          ],
          "visited": [
            [2, 2]
          ],
          "obstacles": [
            [2, 3]
          ],
          "target": [5, 5]
        }
      },
      {
        "stepIndex": 1,
        "activeLine": 6,
        "title": "Mô phỏng Nước Đi 1: Lao Cờ Trực Diện",
        "desc": "Thử đưa quân Kéo đến (3, 2). Sau khi xét phản ứng của đối thủ, nhánh A được đánh giá +12 điểm. Đây là lựa chọn tốt nhất tạm thời.",
        "stats": {
          "depth": 2,
          "alpha": "+12",
          "beta": "+inf",
          "evaluatedNodes": 4,
          "cutoffs": 0
        },
        "gridState": {
          "highlight": [
            [3, 2]
          ],
          "path": [
            [2, 2],
            [3, 2]
          ],
          "visited": [
            [2, 2],
            [3, 2]
          ],
          "obstacles": [
            [2, 3]
          ],
          "target": [5, 5]
        }
      },
      {
        "stepIndex": 2,
        "activeLine": 16,
        "title": "Phát hiện Nhánh Tệ -> TỈA NHÁNH (Cutoff)",
        "desc": "Xét nhánh B tới (2, 1), gần quân Búa địch. Nếu đối thủ có thể giữ giá trị nhánh này không quá +8, ta không cần xét tiếp: đã có nhánh A đạt +12.",
        "stats": {
          "depth": 2,
          "alpha": "+12",
          "beta": "+8",
          "evaluatedNodes": 6,
          "cutoffs": 1
        },
        "gridState": {
          "highlight": [
            [2, 1]
          ],
          "path": [
            [2, 2],
            [2, 1]
          ],
          "visited": [
            [2, 2],
            [3, 2],
            [2, 1]
          ],
          "obstacles": [
            [2, 3]
          ],
          "target": [5, 5]
        }
      },
      {
        "stepIndex": 3,
        "activeLine": 9,
        "title": "Chọn Nước Đi Tối Ưu Nhất",
        "desc": "Giữ nhánh A với +12 điểm trong các nhánh minh họa. Hiệu quả phụ thuộc hàm đánh giá và độ sâu tìm kiếm, không bảo đảm thắng cả ván.",
        "stats": {
          "depth": 3,
          "alpha": "+12",
          "beta": "+12",
          "evaluatedNodes": 9,
          "cutoffs": 2
        },
        "gridState": {
          "highlight": [
            [3, 2]
          ],
          "path": [
            [2, 2],
            [3, 2]
          ],
          "visited": [
            [2, 2],
            [3, 2],
            [2, 1]
          ],
          "obstacles": [
            [2, 3]
          ],
          "target": [5, 5]
        }
      }
    ]
  },
  {
    "id": "heuristic",
    "name": "Heuristic — Đánh giá thế cờ",
    "badge": "Đánh giá thế cờ",
    "difficulty": "Cơ bản",
    "complexity": "Hàm đánh giá",
    "summary": "Cộng điểm quân số, tương khắc và vị trí để bot so sánh nhanh các thế cờ.",
    "pseudocode": [
      "def evaluate_state(state):",
      "    score = 0",
      "    # 1. Trọng số chênh lệch quân số",
      "    score += (my_piece_count - enemy_piece_count) * 100",
      "    # 2. Lợi thế tương khắc trực tiếp",
      "    score += calculate_counter_advantage(my_pieces, enemy_pieces) * 40",
      "    # 3. Khoảng cách gần cờ đối phương",
      "    score += (18 - min_distance_to_enemy_flag) * 25",
      "    # 4. Kiểm soát bình Tăng tốc & Đồng hóa",
      "    score += controlled_potions_count * 15",
      "    return score"
    ],
    "steps": [
      {
        "stepIndex": 0,
        "activeLine": 3,
        "title": "Bước 1: So sánh Lực Lượng Quân Số",
        "desc": "Ta có 3 quân (1 Búa, 1 Kéo, 1 Bao). Địch còn 2 quân (1 Kéo, 1 Bao). Lợi thế: +100 điểm.",
        "stats": {
          "pieceAdvantage": "+1 quân",
          "counterScore": "+40",
          "flagBonus": "+75",
          "totalScore": "+215"
        },
        "gridState": {
          "highlight": [
            [1, 1],
            [1, 2],
            [2, 1]
          ],
          "path": [
            [1, 1]
          ],
          "visited": [
            [1, 1]
          ],
          "obstacles": [],
          "target": [4, 4]
        }
      },
      {
        "stepIndex": 1,
        "activeLine": 5,
        "title": "Bước 2: Phân Tích Ma Trận Khắc Chế",
        "desc": "Quân Búa của ta đang kề cận quân Kéo của địch (Búa ăn Kéo). Lợi thế ăn quân ngay lập tức: +40 điểm.",
        "stats": {
          "pieceAdvantage": "+1 quân",
          "counterScore": "+80",
          "flagBonus": "+75",
          "totalScore": "+255"
        },
        "gridState": {
          "highlight": [
            [1, 2],
            [1, 3]
          ],
          "path": [
            [1, 2],
            [1, 3]
          ],
          "visited": [
            [1, 2],
            [1, 3]
          ],
          "obstacles": [],
          "target": [4, 4]
        }
      },
      {
        "stepIndex": 2,
        "activeLine": 7,
        "title": "Bước 3: Khoảng Cách Cướp Cờ",
        "desc": "Trong thế cờ minh họa này, quân Giấy ở (3, 4) chỉ cách cờ (4, 4) một lượt. Thưởng thêm điểm tiếp cận cờ giúp bot ưu tiên mục tiêu này.",
        "stats": {
          "pieceAdvantage": "+1 quân",
          "counterScore": "+80",
          "flagBonus": "+150",
          "totalScore": "+330"
        },
        "gridState": {
          "highlight": [
            [3, 4],
            [4, 4]
          ],
          "path": [
            [3, 4],
            [4, 4]
          ],
          "visited": [
            [3, 4],
            [4, 4]
          ],
          "obstacles": [],
          "target": [4, 4]
        }
      }
    ]
  }
];
