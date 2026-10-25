# Mất mạng và hỏi đáp Ban tổ chức

## Triển khai

Render chạy `backend/src/scripts/deployDatabase.js` trước khi khởi động. Migration `resilience.sql` thêm bảng nhận bài, hỏi đáp và khôi phục mật khẩu; chạy lại không xóa dữ liệu cũ. Cần deploy cả backend Render và frontend Cloudflare Pages từ cùng commit. Không chạy `prisma db push --accept-data-loss` lên database đang dùng.

Hàng nhận bài dùng PostgreSQL nên không phụ thuộc Redis. Một tiến trình API kiểm tra một bài tại một thời điểm bằng worker thread. Các instance cùng dùng lease 45 giây để khôi phục bài nếu tiến trình chết. Mã bot cố định theo biên nhận ngăn tạo bot trùng nếu đã lưu bot nhưng mất phản hồi. Nguồn đã nhận được lưu trong database; ổ lưu bot có thể khôi phục từ nguồn này theo cơ chế hiện có.

Lỗi cú pháp/nước đi được đánh dấu từ chối, giữ lại nguồn để đối chiếu. Lỗi hạ tầng giữ trạng thái chờ, thử lại với khoảng nghỉ tối đa 60 giây. Admin tạm dừng/tiếp tục kiểm tra bài tại **Trạng thái hệ thống**. Tạm dừng này chỉ áp dụng bước kiểm tra bài nộp, không dừng trận đang chạy. Judge giải đấu có heartbeat Redis, kết quả và Elo ghi trong một transaction, retry không cộng Elo lần hai.

## Trình duyệt

- Mã, tên bot và file được lưu trong IndexedDB theo tài khoản. Nháp lưu sau 250 ms và khi trang bị ẩn; mất điện vẫn có thể mất phần chưa kịp ghi.
- Bấm nộp sẽ ghi bài vào IndexedDB trước. Chỉ biên nhận hợp lệ từ server mới chuyển thành “máy chủ đã nhận”. Timeout hoặc mất phản hồi giữ mã nộp cũ để thử lại.
- Tự gửi khi mở trang, có mạng trở lại và định kỳ 10 giây nếu có mục chờ; hàng chờ rỗng không gọi mạng nền. Không hứa gửi nền khi đã đóng trình duyệt. Trước mỗi lần gửi kiểm tra tài khoản qua `/auth/me`; không gửi hàng chờ của tài khoản khác. 401/403 dừng gửi để đăng nhập lại.
- Bản dự phòng JSON có thể tải và khôi phục cho đúng tài khoản, giữ nguyên mã nộp. Mỗi tài khoản tối đa 20 mục chưa gửi trên một thiết bị. Không xóa dữ liệu trình duyệt trước khi có biên nhận.
- Đăng ký giải cũng vào hàng chờ; server khóa hàng giải đấu, kiểm tra bot thuộc người nộp, thời gian và sức chứa. Gửi lại cùng đăng ký thành công trả về xác nhận cũ, kể cả giải đã bắt đầu. Giờ lưu offline không thay cho giờ server nhận; không tự nhận bài quá hạn.

Mở **Trạng thái hệ thống** để xem biên nhận và bản sao lưu; chi tiết hàng chờ được thu gọn và danh sách bài đã xong chỉ hiện khi người chơi mở. Trang này cũng có **Phòng thử bot ngoại tuyến** và nút tải gói khi còn mạng để lưu các trang và Python. Chỉ cache tài nguyên giao diện/runtime, không cache API hay token trong service worker. Pyodide 0.27.7 tải từ CDN được dẫn trong [tài liệu chính thức](https://pyodide.org/en/0.27.7/usage/quickstart.html). Runtime khoảng 13.2 MiB, cộng giao diện; UI hiển thị dung lượng thực tế. Cần HTTPS/localhost, WebAssembly, Service Worker và IndexedDB. Trình duyệt có thể thu hồi cache khi thiếu bộ nhớ.

Đấu thử Python dùng cùng bộ luật và bot mẫu với backend, trong worker của iframe sandbox có origin riêng và CSP chặn mạng. Không cấp token/dữ liệu tài khoản cho Python. Mỗi lượt thử có giới hạn 3 giây; kết quả cục bộ không tính điểm. Thư viện ngoài chuẩn không được tự tải. Mở lại trang sau mất mạng chỉ hoạt động nếu gói đã tải đủ.

## Hỏi đáp và quyền truy cập

Kênh chat socket công khai đã bỏ. Học sinh chỉ xem câu hỏi của mình; Admin/Giáo viên trả lời qua API có xác thực và kiểm tra vai trò từ database. FAQ công khai bỏ toàn bộ trường nhận dạng người gửi. Ban tổ chức phải kiểm tra nội dung không chứa thông tin cá nhân trước khi chọn công khai; nội dung tự do không thể tự động bảo đảm ẩn danh hoàn toàn.

Vai trò giáo viên cần `TEACHER_REGISTRATION_SECRET`, admin cần `ADMIN_REGISTRATION_SECRET`. Không cấu hình thì không tự đăng ký được các vai trò này. Các tài khoản giáo viên đã tồn tại giữ vai trò; Admin cần rà soát nếu trước đây cho đăng ký giáo viên tự do.

Đăng ký mới có MSSV, tên đội, email duy nhất không phân biệt hoa thường và đồng ý xử lý dữ liệu. Tài khoản cũ giữ tên đăng nhập; có thể cần Admin hỗ trợ bổ sung email trước khi khôi phục qua mail.

## Email khôi phục mật khẩu

Backend hỗ trợ Resend qua HTTPS (khuyên dùng trên Render) và SMTP. Tạo tài khoản Resend, thêm tên miền gửi mà bạn quản lý, xác minh bản ghi DNS do Resend cung cấp trong Cloudflare, rồi tạo API key chỉ có quyền gửi thư. Địa chỉ người gửi phải thuộc tên miền đã xác minh. Resend chỉ cho gửi bằng địa chỉ thử nghiệm tới hộp thư kiểm tra của chính họ; muốn gửi cho người chơi cần xác minh tên miền gửi.

Trong Render, đặt các biến kín sau; không commit API key hoặc gửi nó trong chat:

```
RESEND_API_KEY=re_...
EMAIL_FROM=BattleCode <noreply@ten-mien-cua-ban.vn>
PASSWORD_RESET_URL=https://batte-code-2.pages.dev/
```

Blueprint đã khai báo sẵn ba biến này. Nếu dùng tên miền Cloudflare Pages khác, cập nhật `PASSWORD_RESET_URL` thành URL trang thật. Gửi API qua HTTPS cũng hoạt động trên Render Free; Render chặn SMTP outbound ở cổng 25/465/587 đối với dịch vụ Free. Có thể dùng SMTP bằng cách bỏ `RESEND_API_KEY` và cấu hình `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` (SMTP cần dịch vụ Render cho phép cổng đó).

Sau khi deploy backend, kiểm tra `https://<URL-Render>/api/auth/recovery-status`; trường `available` phải là `true`. Sau đó thử “Quên mật khẩu” bằng email đã gắn với tài khoản, kiểm tra cả Spam, mở liên kết trong 15 phút và đặt mật khẩu mới. Link dùng token một lần; database chỉ lưu hash, token nằm trong fragment để không lọt vào access log theo query, và đổi mật khẩu sẽ thu hồi các phiên cũ. Kiểm thử gửi thư dùng API/transport giả, không gửi mail thật.

## Kiểm tra

`frontend`: `npm run test:offline`, `npm run test:bot-flows`, `npm run build`.

`backend`: `TEST_PGLITE_MODULE` trỏ tới module PGlite cục bộ, `PYTHON_EXECUTABLE` tới Python rồi chạy `npm run test:resilience`. Test chỉ tạo database trong bộ nhớ, không truy cập database thật.
