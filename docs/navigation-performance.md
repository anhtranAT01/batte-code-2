# Độ trễ khi mở các mục

Các điểm nghẽn đã xử lý:

- Tách nội dung trang bằng React.memo và callbacks ổn định. Cập nhật số người online, trạng thái socket hoặc mở modal không dựng lại toàn bộ trang hiện tại. Không giữ màn đấu ẩn chạy trong nền; rời trận vẫn hủy tiến trình như trước.
- Tải dần các module giao diện trong lúc trình duyệt rảnh; dừng khi tab ẩn và bỏ qua nền nếu bật tiết kiệm dữ liệu/mạng 2G. Hover, focus hoặc pointer-down làm ấm module và dữ liệu của đúng mục sắp mở.
- Chia sẻ các lượt đọc danh sách người chơi, bot của chủ tài khoản, mẫu bot và danh sách giải. Dữ liệu mới được dùng lại 5 giây, mẫu bot 5 phút. Snapshot tối đa 60 giây giúp hiện giao diện ngay trong khi đọc lại nền. Sau 60 giây, màn hình chờ dữ liệu mới. Nút làm mới PvP luôn bỏ qua snapshot. Danh sách sẵn sàng có thể đổi trong lúc lấy lại; máy chủ vẫn kiểm tra bot và quyền sở hữu khi khởi tranh.
- Dữ liệu bot riêng được khóa theo Authorization, chỉ giữ trong RAM (tối đa 40 mục), xóa khi logout và trước/sau thay đổi qua API. Không cache mật khẩu, bài nộp, replay, stats Admin hay dữ liệu tùy ý. Một người rời màn hình không hủy lượt đọc chung mà màn khác đang dùng; lượt đọc được giới hạn 10 giây. Phản hồi cũ không ghi đè cache mới.
- Danh sách bot chỉ đọc các cột cần hiển thị, không truyền source_code từ PostgreSQL sang API chỉ để loại bỏ sau đó. Thống kê trận bot dùng hai nhánh có index thay vì JOIN OR và GROUP BY toàn bộ bot. Giữ chính xác trường hợp cùng bot xuất hiện ở cả hai phe.
- Các đường nộp Git và kiểm tra cú pháp Python dùng execFile bất đồng bộ, truyền tham số riêng, có timeout. Trước đây clone Git/py_compile đồng bộ có thể giữ event loop API đến khi xong, làm các yêu cầu khác phải chờ. Kiểm tra thực thi bot vẫn giữ nguyên.

## Kiểm chứng

- `frontend: npm run test:navigation`: cache/đọc chung, dữ liệu cũ và revalidate, tách tài khoản, hủy riêng, race khi force refresh, timeout, invalidation qua mutation; 70 lần đổi online count không vẽ lại trang hiện tại.
- `backend: npm run test:navigation-reads` với `TEST_PGLITE_MODULE`: DB PostgreSQL tạm, migration index chạy hai lần, quyền sở hữu và thống kê không đếm trùng. Fixture có source lớn: lượng JSON trả từ truy vấn giảm 2.200.675 xuống 745 byte. Đây là dữ liệu thử, tỷ lệ thực tế tùy bot.
- `backend: npm run test:nonblocking-validation`: chạy tiến trình con thật được cố ý làm chậm; ping HTTP khác hoàn thành trong khi compile/clone còn chạy. Lượt đo cục bộ: ping 15/5 ms, tiến trình tương ứng 481/471 ms. Clone được thay bằng fixture cục bộ, không gọi kho Git từ xa.
- Upload multipart Python thật và hai bot Python PvP vẫn qua kiểm thử, cùng với giải đấu, replay, offline queue, quản trị và build.
- Bản preview hỗ trợ `PREVIEW_API_DELAY_MS=800` và `PREVIEW_NAV_METRICS=1` để kiểm tra khi máy chủ chậm. Số đo DOM chỉ xuất vào thuộc tính test `data-fixture-navigation`, không đưa vào giao diện triển khai.
  Trong một lượt kiểm tra trình duyệt cục bộ với độ trễ API 800 ms, lần mở PvP đầu sẵn sàng sau 1.385 ms, quay lại sau 167 ms nhờ snapshot. Bao gồm độ trễ khung hình của trình duyệt thử; không phải p95 hay số đo trên Render.

Ba GET nhẹ trên API Render trước khi đẩy bản này: health 625 ms, players 825 ms, tournaments 488 ms (mỗi đường một mẫu). Đây không phải p95 hay benchmark tải. Đổi mục có thể hiện ngay từ dữ liệu đã đọc, nhưng lần đọc đầu tiên, thao tác ghi và lúc máy chủ/mạng chậm vẫn phụ thuộc độ trễ thực tế. Không có thay đổi CSS nào loại bỏ được thời gian mạng này.

Migration index `backend/src/scripts/navigationPerformance.sql` chạy qua deployDatabase hiện có. Không thay đổi dung lượng hay gói Render tự động.
