# Quản lý tài khoản

Trong trang **Quản trị hệ thống → Tài khoản**, Admin có thể sửa tên đăng nhập, đổi quyền và chọn **Tài khoản / Mật khẩu → Đặt lại mật khẩu**.

Đây là thao tác đặt **mật khẩu mới**. Hệ thống không hiển thị mật khẩu hiện tại hoặc mã băm của người dùng. Mật khẩu mới phải có ít nhất 8 ký tự, tối đa 72 byte UTF-8 và được băm bằng bcrypt trên máy chủ.

Giáo viên không được sửa tên, đổi quyền hoặc đặt lại mật khẩu tài khoản. Các API này kiểm tra lại quyền Admin trong cơ sở dữ liệu, kể cả khi token cũ vẫn ghi quyền Admin. Không thể tự gỡ quyền Admin hoặc gỡ Admin cuối cùng.

API yêu cầu Bearer token của Admin:

- `PUT /api/admin/users/:id/account` với `{ "username": "ten_moi" }`
- `PUT /api/admin/users/:id/role` với `{ "role": "STUDENT" }` (chấp nhận `STUDENT`, `TEACHER` hoặc `ADMIN`)
- `PUT /api/admin/users/:id/password` với `{ "password": "mat_khau_moi" }`

Các lần đăng nhập mới phải dùng mật khẩu mới. Phiên JWT đã cấp vẫn tồn tại đến khi hết hạn; thay đổi này không thêm cơ chế thu hồi phiên. Sau khi đổi quyền, người dùng cần đăng nhập lại để giao diện nhận quyền mới.
