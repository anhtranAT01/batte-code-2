# Gửi email khôi phục qua Google Apps Script trên Render Free

Render Free chặn SMTP. Phương án này dùng Google Apps Script làm HTTPS relay: ứng dụng gửi yêu cầu từ backend qua HTTPS, Apps Script gửi thư bằng tài khoản Gmail bạn cấp quyền. Không cần mua domain. Gmail và Apps Script áp dụng giới hạn gửi thư theo loại tài khoản; phù hợp lưu lượng thấp.

## 1. Tạo Apps Script

1. Mở [script.google.com](https://script.google.com/) bằng Gmail bạn muốn dùng để gửi thư, rồi tạo dự án mới.
2. Thay nội dung `Code.gs` bằng file [`backend/apps-script/Code.gs`](../backend/apps-script/Code.gs) trong repo.
3. Trong **Project Settings → Script properties**, thêm `BATTLECODE_MAIL_SECRET` với một chuỗi ngẫu nhiên dài ít nhất 32 ký tự. Dùng cùng một chuỗi ở bước 3 bên dưới; không đăng chuỗi này lên chat hay GitHub.
4. Chạy một lần hàm `doPost` không cần thiết; thay vào đó chọn **Deploy → New deployment → Web app**. Đặt **Execute as** là tài khoản của bạn và **Who has access** là **Anyone**. Bấm **Deploy** và chấp thuận quyền gửi thư của Google.
5. Sao chép URL kết thúc bằng `/exec`.

Apps Script cần quyền truy cập công khai để Render gọi được mà không cần đăng nhập Google. Endpoint kiểm tra shared secret trước khi gửi, chỉ nhận email/tiêu đề khôi phục hợp lệ và không ghi nội dung yêu cầu vào log. Giữ secret bí mật và chỉ đặt nó trong Script Properties cùng Render Environment.

## 2. Cấu hình Render

Trong `battle-code-api → Environment`, thêm hai biến:

- `GOOGLE_APPS_SCRIPT_URL`: URL Web app `/exec` vừa sao chép.
- `GOOGLE_APPS_SCRIPT_SECRET`: cùng giá trị `BATTLECODE_MAIL_SECRET` đã lưu trong Script Properties.

Giữ `EMAIL_FROM` trỏ tới Gmail gửi thư và `PASSWORD_RESET_URL` trỏ tới trang BattleCode. Backend sẽ ưu tiên Apps Script khi cả hai biến mới được cấu hình; SMTP và Resend được giữ làm phương án dự phòng. Bấm **Save, rebuild, and deploy**.

Sau deploy, gửi thử yêu cầu khôi phục. Nếu Apps Script báo đã nhận nhưng người dùng không thấy thư, kiểm tra Spam và hạn mức email của Apps Script/Gmail. [Google Apps Script áp dụng hạn mức gửi theo loại tài khoản và có thể thay đổi](https://developers.google.com/apps-script/guides/services/quotas).
