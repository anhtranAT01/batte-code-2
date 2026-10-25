# Mất mạng và hỏi đáp Ban tổ chức

## Triển khai

Render chạy `backend/src/scripts/deployDatabase.js` trước khi khởi động. Migration `resilience.sql` thêm bảng nhận bài, hỏi đáp và khôi phục mật khẩu; chạy lại không xóa dữ liệu cũ. Cần deploy cả backend Render và frontend Cloudflare Pages từ cùng commit. Không chạy `prisma db push --accept-data-loss` lên database đang dùng.

Hàng nhận bài dùng PostgreSQL nên không phụ thuộc Redis. Một tiến trình API kiểm tra một bài tại một thời điểm bằng worker thread. Các instance cùng dùng lease 45 giây để khôi phục bài nếu tiến trình chết. Mã bot cố định theo biên nhận ngăn tạo bot trùng nếu đã lưu bot nhưng mất phản hồi. Nguồn đã nhận được lưu trong database; ổ lưu bot có thể khôi phục từ nguồn này theo cơ chế hiện có.

Lỗi cú pháp/nước đi được đánh dấu từ chối, giữ lại nguồn để đối chiếu. Lỗi hạ tầng giữ trạng thái chờ, thử lại với khoảng nghỉ tối đa 60 giây. Admin tạm dừng/tiếp tục kiểm tra bài tại **Trạng thái hệ thống**. Tạm dừng này chỉ áp dụng bước kiểm tra bài nộp, không dừng trận đang chạy. Judge giải đấu có heartbeat Redis, kết quả và Elo ghi trong một transaction, retry không cộng Elo lần hai.

## Trình duyệt

- Mã, tên bot và file được lưu trong IndexedDB theo tài khoản. Nháp lưu sau 250 ms và khi trang bị ẩn; mất điện vẫn có thể mất phần chưa kịp ghi.
- Bấm nộp sẽ ghi bài vào IndexedDB trước. Chỉ biên nhận hợp lệ từ server mới chuyển thành “máy chủ đã nhận”. Timeout hoặc mất phản hồi giữ mã nộp cũ để thử lại.
- Tự gửi khi mở trang, có mạng trở lại và định kỳ 10 giây. Không hứa gửi nền khi đã đóng trình duyệt. Trước mỗi lần gửi kiểm tra tài khoản qua `/auth/me`; không gửi hàng chờ của tài khoản khác. 401/403 dừng gửi để đăng nhập lại.
- Bản dự phòng JSON có thể tải và khôi phục cho đúng tài khoản, giữ nguyên mã nộp. Mỗi tài khoản tối đa 20 mục chưa gửi trên một thiết bị. Không xóa dữ liệu trình duyệt trước khi có biên nhận.
- Đăng ký giải cũng vào hàng chờ; server khóa hàng giải đấu, kiểm tra bot thuộc người nộp, thời gian và sức chứa. Gửi lại cùng đăng ký thành công trả về xác nhận cũ, kể cả giải đã bắt đầu. Giờ lưu offline không thay cho giờ server nhận; không tự nhận bài quá hạn.

**Tải gói offline** tại Kho bot khi còn mạng để lưu các trang và Python. Chỉ cache tài nguyên giao diện/runtime, không cache API hay token trong service worker. Pyodide 0.27.7 tải từ CDN được dẫn trong [tài liệu chính thức](https://pyodide.org/en/0.27.7/usage/quickstart.html). Runtime khoảng 13.2 MiB, cộng giao diện; UI hiển thị dung lượng thực tế. Cần HTTPS/localhost, WebAssembly, Service Worker và IndexedDB. Trình duyệt có thể thu hồi cache khi thiếu bộ nhớ.

Đấu thử Python dùng cùng bộ luật và bot mẫu với backend, trong worker của iframe sandbox có origin riêng và CSP chặn mạng. Không cấp token/dữ liệu tài khoản cho Python. Mỗi lượt thử có giới hạn 3 giây; kết quả cục bộ không tính điểm. Thư viện ngoài chuẩn không được tự tải. Mở lại trang sau mất mạng chỉ hoạt động nếu gói đã tải đủ.

## Hỏi đáp và quyền truy cập

Kênh chat socket công khai đã bỏ. Học sinh chỉ xem câu hỏi của mình; Admin/Giáo viên trả lời qua API có xác thực và kiểm tra vai trò từ database. FAQ công khai bỏ toàn bộ trường nhận dạng người gửi. Ban tổ chức phải kiểm tra nội dung không chứa thông tin cá nhân trước khi chọn công khai; nội dung tự do không thể tự động bảo đảm ẩn danh hoàn toàn.

Vai trò giáo viên cần `TEACHER_REGISTRATION_SECRET`, admin cần `ADMIN_REGISTRATION_SECRET`. Không cấu hình thì không tự đăng ký được các vai trò này. Các tài khoản giáo viên đã tồn tại giữ vai trò; Admin cần rà soát nếu trước đây cho đăng ký giáo viên tự do.

Đăng ký mới có MSSV, tên đội, email duy nhất không phân biệt hoa thường và đồng ý xử lý dữ liệu. Tài khoản cũ giữ tên đăng nhập; có thể cần Admin hỗ trợ bổ sung email trước khi khôi phục qua mail.

## Email khôi phục (chưa bật khi thiếu cấu hình)

Thiết lập bí mật trên Render, không commit vào Git:

```
SMTP_HOST=smtp.your-provider.example
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM=BattleCode <noreply@your-domain.example>
PASSWORD_RESET_URL=https://your-frontend.pages.dev/
```

Chỉ đặt `SMTP_SECURE=true` khi nhà cung cấp yêu cầu TLS ngay khi kết nối (thường cổng 465). Link khôi phục dùng token ngẫu nhiên 15 phút, database chỉ lưu hash, dùng một lần; đổi mật khẩu hủy các phiên trước đó. Token nằm trong fragment để không gửi lên access log theo query. Không cấu hình SMTP thì giao diện báo chưa bật, không thông báo giả đã gửi mail. Kiểm thử mail dùng transport giả, không gửi thư thật.

## Kiểm tra

`frontend`: `npm run test:offline`, `npm run test:bot-flows`, `npm run build`.

`backend`: `TEST_PGLITE_MODULE` trỏ tới module PGlite cục bộ, `PYTHON_EXECUTABLE` tới Python rồi chạy `npm run test:resilience`. Test chỉ tạo database trong bộ nhớ, không truy cập database thật.
