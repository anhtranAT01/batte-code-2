# 🚩 TÀI LIỆU HƯỚNG DẪN LẬP TRÌNH BOT AI - ĐẤU TRƯỜNG CỜ CHIẾN THUẬT CƯỚP CỜ (RPS CHESS)
> Dành cho Sinh viên Đại học (Khoa CNTT, Kỹ thuật Phần mềm, Trí tuệ Nhân tạo)

---

## 1. TỔNG QUAN LUẬT CHƠI & MỤC TIÊU CƯỚP CỜ (CAPTURE THE FLAG)

Trò chơi diễn ra trên bàn cờ kích thước **8x8** hoặc **9x9**. Mỗi bên sở hữu các quân cờ thuộc 3 hệ: **Kéo (Scissors)**, **Búa (Rock)**, và **Bao (Paper)**.

### 🎯 Điều kiện Chiến thắng Tuyệt đối:
1. **🚩 CƯỚP CỜ THÀNH CÔNG (Chiếm Căn Cứ Đối Phương)**:
   - **Phe 1 (Xanh)**: Căn cứ cờ nhà tại `(0, 0)`. Mục tiêu là đưa bất kỳ quân cờ nào của mình tiến vào **Căn cứ cờ Phe 2 tại `(N-1, N-1)`** (ví dụ ô `(8, 8)` trên bàn 9x9 hoặc `(7, 7)` trên bàn 8x8) -> **THẮNG NGAY LẬP TỨC**!
   - **Phe 2 (Đỏ)**: Căn cứ cờ nhà tại `(N-1, N-1)`. Mục tiêu là đưa quân tiến vào **Căn cứ cờ Phe 1 tại `(0, 0)`** -> **THẮNG NGAY LẬP TỨC**!
2. **⚔️ Quét Sạch Quân Địch (Elimination)**: Ăn toàn bộ quân cờ của đối phương.
3. **⏱️ Hết Số Lượt Quy Định (150 lượt)**: Bên nào còn nhiều quân cờ hơn sẽ chiến thắng.

---

## 2. QUY TẮC TƯƠNG KHẮC & BÌNH BẢO VẬT

### A. Tương Khắc Kéo - Búa - Bao
Khi di chuyển vào ô có quân cờ của đối phương:
- **BÚA (Rock / 'R')** đập tan **KÉO (Scissors / 'S')** -> Búa thắng, Kéo bị loại khỏi bàn cờ.
- **KÉO (Scissors / 'S')** cắt đứt **BAO (Paper / 'P')** -> Kéo thắng, Bao bị loại.
- **BAO (Paper / 'P')** bọc gọn **BÚA (Rock / 'R')** -> Bao thắng, Búa bị loại.
- **Cùng hệ**: Cả 2 quân cùng bị loại (Mutual Destruction).

### B. 3 Bình Phần Thưởng (Power-up Potions)
Khi quân cờ đi vào ô có bình bảo vật:
1. **⚡ Bình Tăng Tốc (POTION_SPEED)**: Quân cờ sở hữu buff đi **2 ô liên tiếp** theo hướng thẳng hoặc **1 ô chéo** trong lượt đi tiếp theo. Rất lợi hại để bứt tốc cướp cờ chớp nhoáng!
2. **🧪 Bình Đồng Hóa (POTION_INFECTION)**: Khi quân cờ này ăn quân đối phương, quân đối phương **KHÔNG BỊ CHẾT** mà sẽ bị **đồng hóa biến thành quân phe mình**!
3. **➕ Bình Nhân Bản (POTION_CLONE)**: Ngay khi nhặt bình, một quân cờ phân thân cùng hệ sẽ xuất hiện ở ô liền kề trống để gia tăng quân số.
4. **🧱 Chướng Ngại Vật (OBSTACLE)**: Không thể đi vào hoặc đi xuyên qua.

---

## 3. QUY CHUẨN GIAO TIẾP I/O CỦA BOT PYTHON

Mỗi lượt đi, Server sẽ kích hoạt Bot Python của sinh viên qua tiến trình con (Subprocess) và giao tiếp qua luồng dữ liệu chuẩn:

### 📥 1. Dữ liệu Đầu vào (STDIN)
Server đẩy vào **STDIN** 1 chuỗi JSON chứa toàn bộ trạng thái ván cờ:
```json
{
  "player_id": 1,
  "board_size": 9,
  "turn": 12,
  "my_flag": [0, 0],
  "enemy_flag": [8, 8],
  "target_flag": [8, 8],
  "grid": [
    [
      { "piece": { "id": "p1_r", "player": 1, "type": "ROCK", "hasSpeedBuff": false, "hasInfectionBuff": false }, "item": null },
      { "piece": null, "item": "OBSTACLE" },
      { "piece": null, "item": "POTION_SPEED" }
    ]
  ]
}
```

### 📤 2. Dữ liệu Đầu ra (STDOUT)
Bot của sinh viên bắt buộc phải in ra **ĐÚNG 1 DÒNG JSON DUY NHẤT** lên `sys.stdout` rồi kết thúc:
```json
{"fromRow": 0, "fromCol": 0, "toRow": 1, "toCol": 0}
```

> ⚠️ **LƯU Ý QUAN TRỌNG**:
> - Không dùng lệnh `print()` để in log lung tung ra màn hình vì Server sẽ đọc nhầm vào STDOUT. Nếu muốn debug, hãy dùng `sys.stderr.write("log message\n")`.
> - Thời gian chạy tối đa cho mỗi nước đi là **1.0 giây** (Timeout Protection). Nếu bot bị lặp vô hạn `while True` hoặc chạy quá 1.0s sẽ bị xử thua lập tức.

---

## 4. CÁCH CHẠY THỬ NGHIỆM BOT (TEST LOCAL)

### Bước 1: Tạo file test input giả lập (`test_input.json`)
```json
{
  "player_id": 1,
  "board_size": 9,
  "my_flag": [0, 0],
  "enemy_flag": [8, 8],
  "target_flag": [8, 8],
  "grid": [
    [{"piece": {"player": 1, "type": "ROCK"}, "item": null}, {"piece": null, "item": null}],
    [{"piece": null, "item": null}, {"piece": {"player": 2, "type": "SCISSORS"}, "item": null}]
  ]
}
```

### Bước 2: Chạy kiểm tra bằng lệnh terminal
```bash
python sample-bots/flag_rusher_strategy_bot.py < test_input.json
```
**Kết quả mong đợi:**
```json
{"fromRow": 0, "fromCol": 0, "toRow": 1, "toCol": 0}
```

---

## 5. CÁC CHIẾN THUẬT TIÊU BIỂU GỢI Ý CHO SINH VIÊN

| Chiến Thuật | Tên Kỹ Thuật | Đặc Điểm & Thuật Toán Áp Dụng |
| :--- | :--- | :--- |
| 🚩 **Cướp Cờ Thần Tốc** | *A\* / BFS Flag Rusher* | Dùng thuật toán A\* tìm đường ngắn nhất tới căn cứ `(8,8)` hoặc `(0,0)`, né chướng ngại vật, tận dụng bình Đi 2 bước (⚡) để áp sát và giật cờ trong thời gian ngắn nhất. |
| 🛡️ **Thủ Thành & Phản Công** | *Flag Defender & Counter* | Cắt cử 2-3 quân cờ chốt chặn trước cửa ngõ căn cứ nhà. Bố trí thế trận bọc lót theo bộ 3 Kéo-Búa-Bao để đối phương lao vào là bị bắt bài. |
| ⚔️ **Săn Lùng & Tiêu Diệt** | *Minimax Alpha-Beta* | Dùng cây trò chơi Minimax tìm kiếm nước đi tối ưu 3-4 bước, ưu tiên săn lùng ăn quân đối phương để giành lợi thế quân số tuyệt đối. |
| 🧪 **Thu Thập Bảo Vật** | *Greedy Potion Collector* | Ưu tiên gom các bình Đồng Hóa và Nhân Bản trên bàn cờ trước để biến đổi quân địch và tạo ưu thế áp đảo rồi mới cướp cờ. |
