# Sample Bots - Tactical Rock-Paper-Scissors Arena

Thư mục chứa các Bot mẫu dành cho học sinh và lập trình viên tham gia thi đấu.

## 1. Giao thức giao tiếp (Bot I/O Protocol)
- **Input (STDIN)**: Một chuỗi JSON chứa trạng thái bàn cờ hiện tại và ID người chơi:
  ```json
  {
    "player_id": 1,
    "turn_number": 12,
    "grid": [
      [{"type": "R", "player": 1}, null, null, {"type": "F", "player": 1}],
      [null, null, null, null],
      [null, null, {"type": "OBSTACLE", "player": 0}, null],
      [{"type": "S", "player": 2}, null, null, {"type": "F", "player": 2}]
    ]
  }
  ```
- **Output (STDOUT)**: Một chuỗi JSON mô tả nước đi hợp lệ:
  ```json
  {
    "fromRow": 0,
    "fromCol": 0,
    "toRow": 1,
    "toCol": 0
  }
  ```

## 2. Quy tắc chiến đấu
- `R` (Búa/Rock) thắng `S` (Kéo/Scissors).
- `S` (Kéo/Scissors) thắng `P` (Bao/Paper).
- `P` (Bao/Paper) thắng `R` (Búa/Rock).
- `F` (Cờ chỉ huy): Không thể di chuyển. Bên nào bị đối phương bắt cờ sẽ thua ngay lập tức.
- Giới hạn thời gian mỗi lượt tính toán: `1000ms`. Quá thời gian sẽ bị xử thua theo lý do `TIMEOUT`.
- Nếu Bot lặp lại trạng thái bàn cờ 5 lần liên tiếp sẽ bị xử phạt `INFINITE_LOOP`.
