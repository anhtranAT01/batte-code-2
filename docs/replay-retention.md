# Replay: lưu trữ và hiệu năng

Trong **Admin → Trận đấu → Tự dọn replay**, nhập số ngày lưu rồi bấm **Lưu thời gian**. `0` tắt tự xóa; phạm vi hợp lệ 0–3650 ngày. Mặc định là `0` để Admin chủ động bật. Bật hoặc rút ngắn thời gian cũng áp dụng cho replay cũ đã đủ hạn; giao diện yêu cầu xác nhận vì dữ liệu phát lại đã dọn không khôi phục được.

Thời gian được tính từ lúc chấm xong (`judged_at`), dự phòng bằng ngày tạo cho dữ liệu cũ. Không dọn trận chưa có kết quả, hoặc trận thuộc giải UPCOMING/ONGOING. Các giải này được xét lại khi kết thúc/hủy. Mỗi API instance kiểm tra sau khi khởi động 1 phút, sau đó mỗi 5 phút; khi còn tồn đọng, xử lý từng lô 100 trận, nghỉ 1 giây giữa các lô. Dùng khóa hàng `SKIP LOCKED`, transaction ngắn, giới hạn thời gian truy vấn để không dọn trùng hoặc khóa toàn bộ bảng. Tiến trình có thể phục hồi sau khi khởi động lại.

Chỉ bỏ `steps`, `initialBoard`, `mapConfig`; giữ dòng Matches, mã trận, người chơi, kết quả, Elo, thông tin hiển thị, tổng lượt và dữ liệu bảng điểm. Đánh dấu `replay_expired_at` để danh sách báo hết hạn và API trả HTTP 410. Không xóa bot hay bài nộp. PostgreSQL tái sử dụng vùng lưu trữ sau autovacuum; kích thước ổ đĩa được nhà cung cấp báo có thể chưa giảm ngay. Không chạy VACUUM FULL trong luồng xử lý người chơi.

Migration `backend/src/scripts/replayRetention.sql` chạy tự động trong bước deploy database hiện có, sau `resilience.sql`; có thể chạy lại an toàn. Quyền API GET/PUT `/api/admin/replay-retention` kiểm tra cả JWT và quyền ADMIN hiện tại trong DB. Giáo viên/sinh viên không được đổi chính sách.

## Các thay đổi giúp tải và phát nhanh hơn

- Bảng điểm chỉ nhận số lượt từ PostgreSQL, không tải tất cả bàn cờ theo từng nước. Gom trận theo người chơi trước khi tính thống kê thay vì mỗi người duyệt lại toàn bộ trận.
- Tìm replay bằng UUID đầy đủ sử dụng khóa chính thay vì ép toàn bộ cột UUID thành chuỗi; tìm theo số trận vẫn dùng index riêng.
- Replay HTTP lớn hơn 1 KiB dùng gzip mức 4 nếu client hỗ trợ, xử lý nén bất đồng bộ. Không cache replay trên HTTP để không phục vụ replay đã hết hạn.
- Nhật ký phát lại dựng tối đa 50 dòng mỗi trang, tự chuyển trang khi tua/phát; vẫn truy cập đầy đủ tất cả nước.
- Hủy lần tải cũ khi chọn trận khác/rời màn hình, thời gian chờ tải tối đa 15 giây; dữ liệu về muộn không ghi đè trận đang xem.
- Phiên luyện tập không hoạt động trong 1 giờ được giải phóng khỏi RAM, kiểm tra mỗi 5 phút. Replay đã lưu vẫn tải được từ DB nếu chưa hết hạn.

## Kiểm chứng cục bộ

`npm run test:replay` (frontend): 320 bước, giới hạn 50 dòng, phân trang/tua, hủy tải cũ, replay hết hạn, xác nhận/cancel/lưu/tắt chính sách.

`npm run test:replay-retention` (backend), với `TEST_PGLITE_MODULE` trỏ đến PGlite: PostgreSQL tạm trên máy, không dùng DATABASE_URL hay Redis thật. Bao gồm migration chạy hai lần, mặc định tắt, quyền Admin hiện tại, giới hạn đầu vào, ngưỡng thời gian, bảo vệ giải đang thi và trận chưa kết thúc, lô 100/100/5, giữ kết quả/tổng lượt/bảng điểm, HTTP 410 và gzip. Fixture lặp bàn cờ 447.428 byte còn khoảng 5.818 byte qua gzip; dữ liệu thực tế có tỷ lệ khác.

`npm run test:standings-performance` (backend): fixture 1.000 người/3.500 trận, kiểm tra thống kê giống cách tính cũ. Trung vị 7 lượt đo trên máy phát triển: vòng lặp cũ 28,25 ms, gom trận mới 2,53 ms. Chỉ đo phần tính toán trên fixture trong RAM; không phải cam kết độ trễ toàn bộ hệ thống hoặc sức chứa Render.
