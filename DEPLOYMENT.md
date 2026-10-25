# Deploy: Cloudflare Pages + Render + Supabase

Kiến trúc production của dự án:

```text
Browser -> Cloudflare Pages (React/Vite)
        -> Render Web Service (Express + Socket.IO + Judge Worker)
               |-> Supabase PostgreSQL
               |-> Render Key Value (BullMQ)
               `-> Render Persistent Disk (mã nguồn bot)
```

## 1. Tạo Supabase PostgreSQL

1. Tạo một project trong Supabase.
2. Mở **Connect > Session pooler** và sao chép connection string cổng `5432`.
3. Thay `[YOUR-PASSWORD]` bằng mật khẩu database đã URL-encode.
4. Thêm `?sslmode=require` vào cuối URL nếu URL chưa có tham số SSL.

Ví dụ hình dạng URL (không tự đoán `POOLER_HOST`, phải sao chép từ Supabase):

```text
postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require
```

Không đưa URL này vào frontend hoặc commit vào Git. Render sẽ tự tạo bảng và map mặc định bằng lệnh `preDeployCommand` trong `render.yaml`. Tài khoản admin không được tạo tự động để tránh mật khẩu mặc định trên production.

## 2. Deploy backend trên Render

1. Đẩy repository này lên GitHub/GitLab/Bitbucket.
2. Trong Render chọn **New > Blueprint** và chọn repository.
3. Render đọc file `render.yaml` và tạo:
   - `battle-code-api`: API, Socket.IO và judge worker;
   - `battle-code-queue`: hàng đợi Redis tương thích;
   - disk 5 GB lưu bot tại `/var/data/bots`.
4. Khi Render hỏi biến có `sync: false`, nhập:
   - `DATABASE_URL`: Session pooler URL ở bước Supabase;
   - `CORS_ORIGIN`: URL Cloudflare Pages dự kiến, ví dụ `https://battle-code.pages.dev`.
   - `RESEND_API_KEY` và `EMAIL_FROM` để bật email khôi phục (xem mục cấu hình bên dưới).
5. Chờ health check `/api/health` trả về `200` và ghi lại URL Render, ví dụ `https://battle-code-api.onrender.com`.

Blueprint dùng gói Render trả phí tối thiểu vì persistent disk không dùng được với web service miễn phí. Có thể bỏ phần `disk` và đổi plan thành `free` để thử giao diện, nhưng bot đã tải lên sẽ mất khi service restart hoặc deploy lại.

## 3. Deploy frontend trên Cloudflare Pages

Trong **Workers & Pages > Create > Pages > Connect to Git**, cấu hình:

| Trường | Giá trị |
| --- | --- |
| Root directory | `frontend` |
| Framework preset | `Vite` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variable | `VITE_API_URL=https://battle-code-api.onrender.com` |

Thêm `VITE_API_URL` cho cả Production và Preview nếu muốn preview gọi cùng backend. Không thêm `/api` hoặc dấu `/` cuối URL.

File `frontend/public/_redirects` xử lý SPA route; `_headers` thêm các HTTP security header và cache asset.

## 4. Hoàn tất CORS và kiểm tra

Nếu URL Pages thực tế khác URL đã nhập lúc tạo Blueprint, cập nhật `CORS_ORIGIN` trên Render. Có thể cho phép nhiều origin bằng dấu phẩy:

```text
https://battle-code.pages.dev,https://battle-code.example.com
```

Redeploy Render rồi kiểm tra:

1. `https://RENDER_URL/api/health` báo `HEALTHY` và database `CONNECTED`.
2. Trang Cloudflare tải được bảng xếp hạng.
3. Đăng ký, đăng nhập và tải một bot Python.
4. Chạy bot-vs-bot, sau đó mở replay.
5. Mở DevTools và xác nhận kết nối Socket.IO tới Render không có lỗi CORS.

## Biến môi trường production

### Render

| Biến | Nguồn |
| --- | --- |
| `DATABASE_URL` | Supabase Session pooler, bí mật |
| `JWT_SECRET` | Render tự sinh |
| `CORS_ORIGIN` | URL Pages/custom domain |
| `REDIS_HOST`, `REDIS_PORT` | Render Blueprint tự nối |
| `REDIS_URL` | Có thể dùng thay cho host/port khi tạo service thủ công |
| `BOT_STORAGE_ROOT` | `/var/data/bots` |
| `RESEND_API_KEY` | Khóa Resend chỉ có quyền gửi email; giữ kín trên Render |
| `EMAIL_FROM` | Người gửi thuộc tên miền đã xác minh, ví dụ `BattleCode <noreply@domain.vn>` |
| `PASSWORD_RESET_URL` | URL trang Cloudflare Pages nhận liên kết khôi phục |

### Cloudflare Pages

| Biến | Giá trị |
| --- | --- |
| `VITE_API_URL` | URL HTTPS công khai của Render |

Để gửi mail khôi phục, thêm tên miền bạn sở hữu vào Resend, sao chép bản ghi DNS của Resend vào Cloudflare và chờ xác minh. Sau đó đặt `RESEND_API_KEY` và `EMAIL_FROM` trên Render. Không dùng `onboarding@resend.dev` cho tài khoản người chơi; địa chỉ đó chỉ dùng để gửi thư thử nghiệm. Chi tiết cấu hình và kiểm tra nằm trong [docs/offline-and-support.md](docs/offline-and-support.md).
