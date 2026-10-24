# 📘 TÀI LIỆU HƯỚNG DẪN LẬP TRÌNH BOT PYTHON - CƯỚP CỜ (RPS CHESS)
Chi tiết tài liệu hướng dẫn lập trình thuật toán Bot AI bằng Python đã được biên soạn đầy đủ tại:
👉 [BOT_DEVELOPMENT_GUIDE.md](file:///e:/Battle_Code_Code_2/sample-bots/BOT_DEVELOPMENT_GUIDE.md)

### Tóm tắt nhanh:
1. **Mục tiêu**: Đưa quân đến ô Cờ Căn Cứ đối phương `(8, 8)` (nếu là P1) hoặc `(0, 0)` (nếu là P2) để Thắng ngay!
2. **Quy tắc Kéo Búa Bao**: Búa đập Kéo, Kéo cắt Bao, Bao bọc Búa.
3. **Bình Potion**: ⚡ Tăng tốc 2 bước, 🧪 Đồng hóa quân địch, ➕ Nhân bản quân.
4. **Input STDIN**: JSON `{"player_id": 1, "board_size": 9, "target_flag": [8,8], "grid": [...]}`.
5. **Output STDOUT**: In ra duy nhất 1 dòng JSON: `{"fromRow": r1, "fromCol": c1, "toRow": r2, "toCol": c2}`.
6. **File Bot Mẫu Chạy Thử**: [sample-bots/flag_rusher_strategy_bot.py](file:///e:/Battle_Code_Code_2/sample-bots/flag_rusher_strategy_bot.py).
