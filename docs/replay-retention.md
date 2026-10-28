# Replay: lưu trữ và hiệu năng

Hai loại replay có chính sách riêng:

- **Đấu với máy (Boss/luyện tập):** luôn hết hạn sau 24 giờ từ lúc chấm xong (`judged_at`, dự phòng `created_at` cho trận cũ).
- **PvP giữa người chơi:** mặc định không tự xóa. Chỉ Admin hiện tại được đặt số ngày ở **Admin → Trận đấu → Thời gian lưu replay PvP**; `0` giữ vô thời hạn, phạm vi 0–3650 ngày. Giáo viên/sinh viên không được thay đổi. Cài đặt này không tác động đến hạn 24 giờ của trận với máy.

Trận chưa có kết quả không bị dọn. Chính sách được kiểm tra ngay khi tải replay, API trả 410 khi hết hạn. Bảng lịch sử và trang quản trị trả cùng trạng thái hết hạn. Các bản đã dọn trước khi đổi chính sách không phục hồi được.

Tiến trình nền kiểm tra sau khi khởi động 1 phút, rồi mỗi 5 phút. Mỗi lô tối đa 100 trận; nghỉ 1 giây khi còn tồn đọng, dùng transaction ngắn và `SKIP LOCKED` để nhiều instance không dọn trùng. Lọc theo mốc thời gian có index trước khi xét chính sách.

Chỉ bỏ `steps`, `initialBoard`, `mapConfig`; giữ dòng Matches, mã trận, kết quả, Elo, tên người chơi, tổng lượt và bảng điểm. PostgreSQL có thể tái sử dụng vùng lưu trữ sau autovacuum; số dung lượng ổ đĩa không nhất thiết giảm ngay. Không chạy VACUUM FULL trên luồng người chơi.

Migration `replayRetentionScopes.sql` tạo cấu hình PvP riêng (`pvp_replay_retention`) một lần và bảo toàn các thay đổi sau này của Admin. Khóa `replay_retention` cũ không còn điều khiển chính sách. Chế độ mới được nhận diện qua metadata `PVP`/`PRACTICE`; trận cũ dựa vào hai tài khoản tham gia (trận luyện tập từng dùng cùng một tài khoản ở hai phe vẫn được nhận diện là đấu máy).

## Xem trực tiếp trận bot

Đấu Boss và PvP nhận bàn cờ qua luồng NDJSON trong khi máy chấm chạy. Mặc định hiển thị ngay snapshot mới nhất, không xếp hàng phát từng bước chậm hơn máy chấm. Người xem có thể tạm dừng/tua lại mà trận vẫn tiếp tục, rồi bấm **Về trực tiếp** để về lượt mới nhất. Khi kết thúc có thể chủ động xem lại từ đầu. Tốc độ 1x/2x/4x chỉ điều khiển phát lại. Hạn lưu phía máy chủ không thu hồi những bản người dùng đã tải về.

## Các thay đổi giúp tải và phát nhanh hơn

- Bảng điểm chỉ nhận số lượt từ PostgreSQL, không tải tất cả bàn cờ theo từng nước. Gom trận theo người chơi trước khi tính thống kê thay vì mỗi người duyệt lại toàn bộ trận.
- Tìm replay bằng UUID đầy đủ sử dụng khóa chính thay vì ép toàn bộ cột UUID thành chuỗi; tìm theo số trận vẫn dùng index riêng.
- Replay HTTP lớn hơn 1 KiB dùng gzip mức 4 nếu client hỗ trợ, xử lý nén bất đồng bộ. Không cache replay trên HTTP để không phục vụ replay đã hết hạn.
- Nhật ký phát lại dựng tối đa 50 dòng mỗi trang, tự chuyển trang khi tua/phát; vẫn truy cập đầy đủ tất cả nước.
- Hủy lần tải cũ khi chọn trận khác/rời màn hình, thời gian chờ tải tối đa 15 giây; dữ liệu về muộn không ghi đè trận đang xem.
- Phiên luyện tập không hoạt động trong 1 giờ được giải phóng khỏi RAM, kiểm tra mỗi 5 phút. Replay đã lưu vẫn tải được từ DB nếu chưa hết hạn.

## Kiểm chứng cục bộ

`npm run test:replay` (frontend): 320 bước, giới hạn 50 dòng, phân trang/tua, hủy tải cũ, replay hết hạn, xác nhận/cancel/lưu/tắt chính sách.

`npm run test:replay-retention` (backend), với `TEST_PGLITE_MODULE` trỏ đến PGlite: PostgreSQL tạm trên máy, không dùng DATABASE_URL hay Redis thật. Bao gồm migration chạy lại an toàn, chính sách máy 24 giờ và PvP mặc định giữ lại, quyền Admin, chế độ cũ và đối thủ đã xóa, hết hạn ngay cả trước khi dọn, quyền Admin hiện tại, giới hạn đầu vào, bảo vệ trận chưa kết thúc, lô 100/100/5, giữ kết quả/tổng lượt/bảng điểm, HTTP 410 và gzip. Fixture lặp bàn cờ 447.428 byte còn khoảng 5.818 byte qua gzip; dữ liệu thực tế có tỷ lệ khác.

`npm run test:standings-performance` (backend): fixture 1.000 người/3.500 trận, kiểm tra thống kê giống cách tính cũ. Trung vị 7 lượt đo trên máy phát triển: vòng lặp cũ 28,25 ms, gom trận mới 2,53 ms. Chỉ đo phần tính toán trên fixture trong RAM; không phải cam kết độ trễ toàn bộ hệ thống hoặc sức chứa Render.

`node tests/duel-stream.cjs` (frontend): nhận snapshot trước khi trận kết thúc, bám lượt mới nhất, tạm dừng/tua/về trực tiếp trong khi luồng vẫn chạy và hủy khi rời màn hình.

Nhật ký trực tiếp Boss/PvP chỉ dựng tối đa 50 lượt gần vị trí đang xem; thanh tua vẫn truy cập mọi bước. Không đổi dữ liệu nước đi, luật hay thuật toán.
